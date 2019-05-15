#!/usr/bin/env node
process.setMaxListeners(0);

/* 
+   Zoinks is a standalone webcrawler application that uses the open source library of Puppeteer.
*/
const puppeteer = require('puppeteer');
const fs = require('fs');
const args = require('minimist')(process.argv.slice(3))

if(process.argv.length <= 2) {

    console.log("You must provide a url to test.");
    return;

}

if(!!args && (process.argv[2] === "--help" || process.argv[2] === "-h")) {

    console.log("\x1b[36m--haslogin\x1b[0m (bool) [Sets flag telling runner to log-in to a provided account before crawling.]");
    console.log("\x1b[36m--takescreenshotseverypage\x1b[0m (bool) [Take a screenshot on successful page loads, in addition to the failed ones.]");
    console.log("\x1b[36m--failonjavascripterror\x1b[0m (bool) [Fail a page check if a Javascript error is detected in the browser console.]");
    console.log("\x1b[36m--addbase\x1b[0m (comma-delimited list of strings)[Additional base urls in anchor tags that will not be ignored if found on website while scraping.]");
    console.log("\x1b[36m--ignorepaths\x1b[0m (comma-delimited list of strings) [Urls containing these paths will not be checked by the runner.]");
    console.log("\x1b[36m--loginpath\x1b[0m (string) [The path, excluding base url, to the supplied website's log-in form. Ignored if `haslogin` not provided.]");
    console.log("\x1b[36m--protocol\x1b[0m (string) [Https (default) or http.]");
    console.log("\x1b[36m--username\x1b[0m (string) [Username or email to log in with. Ignored if `haslogin` not provided.]");
    console.log("\x1b[36m--password\x1b[0m (string) [User password to log in with. Ignored if `haslogin` not provided.]");
    console.log("\x1b[36m--contentloadselector\x1b[0m (string) [Css selector that will locate an element on the page that would only exist if page load has completed. This selector must be available on all pages. If not provided, content load check will not be performed.]");
    console.log("\x1b[36m--maxsequentialerrors\x1b[0m (number) [The number of sequential failed tests before exiting test early on suspicion of website being down. This is primarily for fast failing when zoinks is being used for CI health checks. Default is 2. This means that 2 concurrent failures after the initial error will cause an early exit.]");
    console.log("\x1b[36m--loginconfirmedselector\x1b[0m (string) [Css selector that will locate an element on the page that would only exist if user has successfully logged in.]");
    console.log("\x1b[36m--usernameinputselector\x1b[0m (string) [Css selector that will locate the username/email field on a website's log-in page.]");
    console.log("\x1b[36m--passwordinputselector\x1b[0m (string) [Css selector that will locate the password field on a website's log-in page.]");
    console.log("\x1b[36m--loginbuttonselector\x1b[0m (string) [Css selector that will locate the log-in button on a website's log-in page.]");
    return;

}

function UnencodeQuotes(string) {

    return string.replace(/%22/g, "'").replace(/%27/g, "'");

}

const promisify =  require('util').promisify;
const link = promisify(fs.link);
const unlink = promisify(fs.unlink);

//Functionality Flags
let HAS_LOGIN = !args["haslogin"] ? false : true; //Does the website under test have logins? Leave account-related fields after this one as empty strings if no login system exists.
let TAKE_SCREENSHOT_EVERY_PAGE = !args["takescreenshotseverypage"] ? false : true; //Take a screenshot for each page?.
let FAIL_ON_JAVASCRIPT = !args["failonjavascripterror"] ? false : true; //Consider Javascript console errors a test failure.

//Website & Account Info
let BASE_URL_TO_CRAWL = process.argv[2].replace("https://", "").replace("http://", ""); //The website being crawled through; ex "basepath.com"
let ADDITIONAL_BASE_URLS_ALLOWED = !args["addbase"] ? [ ] : args["addbase"].split(","); //[ "test.basepath.com" ];
let IGNORE_URLS_CONTAINING = !args["ignorepaths"] ? [ ] : args["ignorepaths"].split(","); //Special cases where the url should be ignored if encountered - both as a direct link and redirect.
let LOGIN_EXTENSION = args["loginpath"] || ""; //The login extension. Not all websites land on the login page. But we want to login immediately before crawling.
let PROTOCOL = args["protocol"] || "https"; //Either http or https.
let USERNAME = args["username"] || "";
let PASSWORD = !args["password"] ? "" : args["password"].replace(/\\/g, "");
let OPTIONAL_CONTENT_SERVED_CHECK_GLOBAL_SELECTOR = !args["contentloadselector"] ? "" : UnencodeQuotes(args["contentloadselector"]); //Some universal css Selector on each page that indicates page content has failed to load, if not located. Leave empty string to skip this check.
let MAX_SEQ_ERRORS_BEFORE_EARLY_ABORT = !args["maxsequentialerrors"] ? 2 : parseInt(args["maxsequentialerrors"]); //Minimum of 1. If set to one, the health check will abort as soon as two pages report errors in a row. The counter is reset with every successful page check.
let FILE_DISPLAY_EXTENSIONS = [".avi", ".doc", ".exe", ".zip", ".gif", ".jpg", ".jpeg", ".mp3", ".mpg", ".mpeg", ".mov", ".qt", ".pdf", ".png", ".rar", ".tiff", ".txt", ".wav", ".zip"];

//Selectors
let SELECTOR_TO_LET_US_KNOW_LOGIN_WAS_SUCCESSFUL_OR_WEBSITE_HAS_LOADED = !args["loginconfirmedselector"] ? "" : UnencodeQuotes(args["loginconfirmedselector"]); //".header_avatar"; //Selector on login landing page to determine if login was successful.
let USERNAME_ELEMENT_SELECTOR = !args["usernameinputselector"] ? "" : UnencodeQuotes(args["usernameinputselector"]); //'#user_login0'; //Selector to find username field on your login page.
let PASSWORD_ELEMENT_SELECTOR = !args["passwordinputselector"] ? "" : UnencodeQuotes(args["passwordinputselector"]); //'#user_pass0'; //Selector to find password field on your login page.
let LOGIN_BUTTON_ELEMENT_SELECTOR = !args["loginbuttonselector"] ? "" : UnencodeQuotes(args["loginbuttonselector"]); //'#wp-submit0'; //Selector to find login button on your login page.

/*
console.log(`BASE_URL_TO_CRAWL = ${BASE_URL_TO_CRAWL}`);
console.log(`ADDITIONAL_BASE_URLS_ALLOWED = ${ADDITIONAL_BASE_URLS_ALLOWED}`);
console.log(`IGNORE_URLS_CONTAINING = ${IGNORE_URLS_CONTAINING}`);
console.log(`LOGIN_EXTENSION = ${LOGIN_EXTENSION}`);
console.log(`PROTOCOL = ${PROTOCOL}`);
console.log(`USERNAME = ${USERNAME}`);
console.log(`PASSWORD = ${PASSWORD}`);
console.log(`OPTIONAL_CONTENT_SERVED_CHECK_GLOBAL_SELECTOR = ${OPTIONAL_CONTENT_SERVED_CHECK_GLOBAL_SELECTOR}`);
console.log(`MAX_SEQ_ERRORS_BEFORE_EARLY_ABORT = ${MAX_SEQ_ERRORS_BEFORE_EARLY_ABORT}`);
console.log(`SELECTOR_TO_LET_US_KNOW_LOGIN_WAS_SUCCESSFUL_OR_WEBSITE_HAS_LOADED = ${SELECTOR_TO_LET_US_KNOW_LOGIN_WAS_SUCCESSFUL_OR_WEBSITE_HAS_LOADED}`);
console.log(`USERNAME_ELEMENT_SELECTOR = ${USERNAME_ELEMENT_SELECTOR}`);
console.log(`PASSWORD_ELEMENT_SELECTOR = ${PASSWORD_ELEMENT_SELECTOR}`);
console.log(`LOGIN_BUTTON_ELEMENT_SELECTOR = ${LOGIN_BUTTON_ELEMENT_SELECTOR}`);
*/

//Global Test Variables
let all_handled_urls = [];
let current_page_urls = [];
let origin_page_urls = [];
let last_url = "";
let base_url_domain = "";
let javascriptErrorCounter = 0;
let javascriptFailureDetected = false;
let errorCounter = 0;
let errorCounterLoadFail = 0;
let full_base_url = "";
let page, browser;
let tearDown = false;
let sequentialErrorCount = 0;

//Logger hook.
function hook(stream, callback) {
    var old_write = stream.write

    stream.write = (function(write) {
        return function(string, encoding, fd) {
            write.apply(stream, arguments)  // comments this line if you don't want output in the console
            callback(string, encoding, fd)
        }
    })(stream.write)

    return function() {
        stream.write = old_write
    }
}

(async() => {

    var ssdir = './screenshots';
    if (!fs.existsSync(ssdir)) {

        console.log("Creating screenshot directory at current script location.");
        fs.mkdirSync(ssdir);

    }

    var logdir = './log';
    if (!fs.existsSync(logdir)) {

        console.log("Creating log directory at current script location.");
        fs.mkdirSync(logdir);

    }

    let logFile = `/zoinks-log-${(+ new Date())}.txt`;
    console.log(`This log [${logFile}]`);
    //Create new log file.
    await unlink(logdir + logFile).catch((e) => {})
    await link(logdir + logFile).catch((e) => {})

    //Begin logging.
    var log_file = fs.createWriteStream(logdir + logFile, {flags : "w"})
    var unhook_stdout = hook(process.stdout, function(string, encoding, fd) {
        log_file.write(string, encoding)
    })

    console.log("Spinning Up Web Crawler\n");
    console.log("\x1b[1m", "This tool will detect and/or report on the following:", "\x1b[0m");
    console.log("\x1b[36m", "SSL certificate errors");
    console.log("\x1b[36m", "Javascript console errors");
    console.log("\x1b[36m", "Non-200 response codes for pages");
    console.log("\x1b[36m", "Optional page content load check (See options for details)");
    console.log("\x1b[0m"); //Reset normal colors.
    last_url = full_base_url = PROTOCOL + "://" + BASE_URL_TO_CRAWL;
    console.log(`Base Url: ${full_base_url}`);
    browser = await puppeteer.launch({headless: true});
    page = await browser.newPage();

    page.on("pageerror", function(err) { 

        console.log("\x1b[33m", "JAVASCRIPT EXCEPTION: " + err.toString(), "\x1b[0m"); 
        javascriptErrorCounter++;
        if(FAIL_ON_JAVASCRIPT) {

            javascriptFailureDetected = true;
            errorCounter ++;
            sequentialErrorCount++;

        }

    });

    page.on("error", function(err) {  

        console.warn("\x1b[33m", "JAVASCRIPT EXCEPTION: " + err.toString(), "\x1b[0m");
        javascriptErrorCounter++;
        if(FAIL_ON_JAVASCRIPT) {

            javascriptFailureDetected = true;
            errorCounter ++;
            sequentialErrorCount++;

        }

    });

    console.log("Chrome ready\n");

    if(HAS_LOGIN) {

        console.log("Performing Login\n");
        let logInSuccess = true;
        await page.goto(full_base_url + (LOGIN_EXTENSION.indexOf("/") == 0 ? LOGIN_EXTENSION : ("/" + LOGIN_EXTENSION)), {waitUntil: 'networkidle2'}).catch((e) => {

            if(e.message.indexOf("ERR_CERT_") >= 0) {

                console.log("\x1b[31m", "**ERROR** Failed to login to website.", "\x1b[0m");
                logInSuccess = false;

            }

        });
        await page.focus(USERNAME_ELEMENT_SELECTOR).catch((e) => { 

            console.log("\x1b[31m", "**ERROR** Failed to login to website. Could not find username by provided selector.", "\x1b[0m");
            logInSuccess = false;

        });
        page.keyboard.type(USERNAME);
        await Wait(1000);
        await page.focus(PASSWORD_ELEMENT_SELECTOR).catch((e) => { 

            console.log("\x1b[31m", "**ERROR** Failed to login to website. Could not find password by provided selector.", "\x1b[0m");
            logInSuccess = false;

        });
        page.keyboard.type(PASSWORD);
        await Wait(1000);
        let loginButton = await page.$(LOGIN_BUTTON_ELEMENT_SELECTOR).catch((e) => { 

            console.log("\x1b[31m", "**ERROR** Failed to login to website. Could not find login button by provided selector.", "\x1b[0m");
            logInSuccess = false;

        });;
        loginButton.click();
        await page.waitForSelector(SELECTOR_TO_LET_US_KNOW_LOGIN_WAS_SUCCESSFUL_OR_WEBSITE_HAS_LOADED).catch(() => {});
        if(await page.$(SELECTOR_TO_LET_US_KNOW_LOGIN_WAS_SUCCESSFUL_OR_WEBSITE_HAS_LOADED) === null) {

            console.log("\x1b[31m", "**ERROR** Failed to login to website. Could not verify confirmation of login by provided selector.", "\x1b[0m");
            logInSuccess = false;

        }

        if(!logInSuccess) {

            await page.screenshot({path: "./screenshots/LoginFailed.png"});
            browser.close();
            return process.kill(process.pid);

        }

    }

   await page.goto(full_base_url, {waitUntil: 'networkidle2'}).catch((e) => {

        if(e.message.indexOf("ERR_CERT_") >= 0) {

            console.log("\x1b[31m", `**ERROR** SSL Certificate error detected [${e.message}]`, "\x1b[0m");
            page.screenshot({path: "./screenshots/LoginFailed.png"});
            browser.close();
            return;

        }

   });

    base_url_domain = BASE_URL_TO_CRAWL.split(".")[1];

    //Grab homepage links.
    current_page_urls = await GetPageUrls();
    if(current_page_urls.filter((x) => { return x === last_url || x === last_url + "/" }).length === 0) {

		current_page_urls.unshift(last_url);

    }

    //Grab all navigatable anchors on the homepage and begin checking one after another recursively.
    for(let h = 0; h < current_page_urls.length; h++) {

        let url_sans_query_string = current_page_urls[h].split("?")[0];
        if((url_sans_query_string.indexOf(BASE_URL_TO_CRAWL) >= 0 || ADDITIONAL_BASE_URLS_ALLOWED.indexOf(url_sans_query_string) >= 0) && url_sans_query_string.length > 0 && all_handled_urls.indexOf(url_sans_query_string) < 0) {

            origin_page_urls.push("Found Url [" + current_page_urls[h] + "] On Page [" + full_base_url + "]");
            await AccessLink(current_page_urls[h]);
            await Wait(100);

        }

    }
    if(sequentialErrorCount > MAX_SEQ_ERRORS_BEFORE_EARLY_ABORT) {

        console.log("\x1b[31m", `**ERROR** ${MAX_SEQ_ERRORS_BEFORE_EARLY_ABORT} errors detected in a row (maxsequentialerrors). Aborting early and notifying stakeholders of possible outage!`, "\x1b[0m");

    }
    console.log("Handled URLs: (" + origin_page_urls.length + ")\n");
    for(let o = 0; o < origin_page_urls.length; o++) {

        console.log(origin_page_urls[o]);

    }

    console.log("\n");
    console.log("\x1b[32m", `Succeeded: ${origin_page_urls.length - errorCounter}`, "\x1b[0m");
    let failureColor = errorCounter > 0 ? "\x1b[31m" : "\x1b[0m"
    console.log(failureColor, `Failed: ${errorCounter}`, failureColor);
    let javascriptErrorColor = errorCounter > 0 ? "\x1b[33m" : "\x1b[0m"
    console.log(javascriptErrorColor, `Javascript Errors: ${javascriptErrorCounter}\n`, "\x1b[0m");

    console.log("Shutting Down\n");
    tearDown = true;
    browser.close();
    return process.kill(process.pid);

})();


/// <summary>
/// Gathers all anchor tags on a page and extracts the urls. These urls are added to the list of hrefs that the webcrawler will navigate too. Invalid links. popup links, and javascript triggers are ignored. Popups cause trouble for the engine in regards to context switching, and returning to the original context.
/// </summary>
async function GetPageUrls() {

    await page.waitForSelector('html').catch((e) => {

        if(tearDown) {

            return [];

        } else {

            return ["UNKNOWN_WEBCRAWLER_PAGE_ERROR"];

        }

    });

    return await page.evaluate(function(){

        let AnchorTags = document.getElementsByTagName("a");
        let ValidHrefs = [];
        for(let x = 0; x < AnchorTags.length; x++) {

            let link = AnchorTags[x].href.split("?")[0];
            link = link.split("#")[0];
            if(!AnchorTags[x].hidden && (AnchorTags[x].href.indexOf("www") == 0 || AnchorTags[x].href.indexOf("http") == 0 && AnchorTags[x].href.indexOf("logout") < 0 && AnchorTags[x].target != "_blank" && ValidHrefs.indexOf(link) < 0)) {

                ValidHrefs.push(link);

            }

        }
        return ValidHrefs;

    }).catch((e) => {});

}

/// <summary>
/// The main loop in the initiator logic handles the landing page links, which are used as a basis from which all other links are mined. All links gathered from each page are added to the total manifest recursively via this method. In this manner, all links deemed valid by GetPageUrls() are ultimately visited (and all links they contain are also added).
/// This would be dramatically simpler in a compiled OO language such as C#, but because of the way Javascript handles sequential logic execution and waiting, along with how CasperJs relies on promises, this (along with associated logic) becomes a reasonable and effective workaround that appends promises in a predictable order to the array of listeners that CasperJS executes in order.
/// </summary>
async function HandleRecursiveSubPages() {

    let current_subpage_urls = await GetPageUrls();
    let untested_urls = 0;
    for(let u = 0; u < current_subpage_urls.length; u++) {

        let url_sans_query_string = current_subpage_urls[u];
        if((url_sans_query_string.indexOf(BASE_URL_TO_CRAWL) >= 0 || ADDITIONAL_BASE_URLS_ALLOWED.indexOf(url_sans_query_string) >= 0) && url_sans_query_string.length > 0 && all_handled_urls.indexOf(url_sans_query_string) < 0) {

            origin_page_urls.push("Found Url [" + current_subpage_urls[u] + "] On Page [" + page.url() + "]");
            untested_urls++;
            await AccessLink(url_sans_query_string);
            await Wait(100);

        }

    }
    if(!!current_subpage_urls && (current_subpage_urls.length == 0 || untested_urls == 0) && page.url().split(base_url_domain)[1].length === 0) {

        await page.goBack().catch((e) => {});

    }

}

function Wait(ms) {

  return new Promise(resolve => setTimeout(resolve, ms));

}

/// <summary>
/// Accesses a single link. If errors are detected, or the page fails to load in a reasonable time, the page is marked as a failure.
/// </summary>
async function AccessLink(href) {

    javascriptFailureDetected = false;
    if(sequentialErrorCount > MAX_SEQ_ERRORS_BEFORE_EARLY_ABORT) {

        return;

    }

    if(all_handled_urls.indexOf(href) < 0) {

        //Check for redirects to non-accepted urls.
        for(let i = 0; i < IGNORE_URLS_CONTAINING.length; i++) {

            if(href.indexOf(IGNORE_URLS_CONTAINING[i]) >= 0) {

                console.log("Ignoring Found URL [" + href + "]", "PARAMETER");
                all_handled_urls.push(href);
                await page.goBack().catch((e) => {});
                return;

            }

        }

        //Navigate to link.
        console.log("Checking: " + href);

        let nonCertError = false;
        //Check for failed load states.
        await page.goto(href, {waitUntil: 'networkidle2'}).catch((e) => {

            if(e.message.indexOf("ERR_CERT_") >= 0) {

                console.log("\x1b[31m", `**ERROR** SSL Certificate error detected [${e.message}]`, "\x1b[0m");
                return;

            } else {

                page.screenshot({path: "./screenshots/Page_Failed_To_Load_" + (errorCounterLoadFail++) + ".png"});
                console.log("\x1b[31m", "**ERROR** The following url failed to load: " + href, "\x1b[0m");
                console.log("Origin: " + last_url + "\nLanded: " + page.url());
                console.log("\x1b[31m", "✘ Failure\n", "\x1b[0m");               
                all_handled_urls.push(href); //Add to the list of already-visited urls that we do not want to re-check.
                nonCertError = true;


            }

       });

        if(nonCertError) {

            await HandleRecursiveSubPages();
            return;

        }

        //Check for redirects to non-accepted urls.
        let newUrl = page.url();
        for(let i = 0; i < IGNORE_URLS_CONTAINING.length; i++) {

            if(newUrl.indexOf(IGNORE_URLS_CONTAINING[i]) >= 0) {

                console.log("Ignoring Redirect URL [" + newUrl + "]", "PARAMETER");
                all_handled_urls.push(href);
                await page.goBack();
                return;

            }

        }

        //Metadata of current page's original call not exposed by browser. Call current page in xhttp request to get response code.
        await page.evaluate(function(){

            let xhttp = new XMLHttpRequest();
            xhttp.timeout = 30000; //Timeout 30 seconds.
            let d = document.getElementsByTagName('body')[0];
            xhttp.onreadystatechange = function() {
              if(this.readyState == 4) {
                d.insertAdjacentHTML("afterend", "<input id='webcrawler_response_code' type='hidden' value='" + this.status + "'/>");
              }
            };
            xhttp.open("GET", document.URL, true);
            xhttp.send();
            
        }).catch((e) => {});

        //Get response code from page when xhttp request is complete.
        await page.waitForSelector('#webcrawler_response_code').catch((e) => { });
        let responseCode = await page.evaluate(function() {

            let el = document.getElementById('webcrawler_response_code');
            return !!el ? el.value : "";

        }).catch((e) => {});

        //Does the Chrome browser detect cert errors for this url/page?
        let sslCertErrors = await page.evaluate(function() {

            let error = document.getElementsByClassName('recurrent-error-message') > 0 && document.getElementsByClassName('ssl') > 0;
            return error;

        }).catch((e) => {});

        //Optional check for univeral element expected on all pages (ex something in header) that indicates that page has loaded in some capacity.
        let contentServed = true;
        if(OPTIONAL_CONTENT_SERVED_CHECK_GLOBAL_SELECTOR.length > 0) {

            await page.waitForSelector(OPTIONAL_CONTENT_SERVED_CHECK_GLOBAL_SELECTOR, 5000).catch((e) => { });
            contentServed = await page.evaluate((selector) => {

                return document.querySelector(selector) != null;

            }, OPTIONAL_CONTENT_SERVED_CHECK_GLOBAL_SELECTOR).catch((e) => {});

        }

        let consoleErrors = await page.evaluate(function() {

            let el = document.getElementsByClassName('error_log');
            return !!el && el.length > 0 ? el[0].value : "";

        });
        if(!!consoleErrors && consoleErrors.length > 0) {

            console.log(`Console Errors Detected! [${consoleErrors}]`);

        }

        //Path is a file. Content is embedded into the html.
        var split = page.url().split(".");
        if(FILE_DISPLAY_EXTENSIONS.filter((f) => { f === split[split.length - 1].toLowerCase(); }).length > 0) {

            console.log("Detected file served. Checking for embedded content.");
            contentServed = !!page.$("embed");

        }

        if(javascriptFailureDetected || !contentServed || (responseCode != 200 && responseCode != 0)) {

            //Failure. Report on it.
            sequentialErrorCount++;
            last_url = href;
            all_handled_urls.push(href); //Add to the list of already-visited urls that we do not want to re-check.
            let screenshotName = "screenshots/Page_" + responseCode + "_Error" + (errorCounter++) + ".png";
            await page.screenshot({path: "./screenshots/" + screenshotName}).catch((e) => {});
            let error = "";
            if(sslCertErrors) {

                error = "SSL Certificate errors detected!";

            } else if (!contentServed) {

                error = "Content failed to serve, regardless of error code returned.";

            } else if (responseCode == 0) {

                error = "Response timed out!";

            } else {

                error = "Non 200 response!";

            }
            console.log(`**ERROR** The url [${href}] lead to a response of ${responseCode} -  Message: ${error} - Screenshot: ${screenshotName}`);
            console.log("\x1b[32m", "✘ Failure\n", "\x1b[0m");
            return;
            
        } else {

            //Success. Screenshot if necessary and begin next test.
            sequentialErrorCount = 0;
            if(TAKE_SCREENSHOT_EVERY_PAGE) {

                let name_formatted = href.replace(full_base_url, "").split("?")[0];
                name_formatted = !!name_formatted && name_formatted.indexOf("/") == 0 ? name_formatted.substr(1) : name_formatted;
                name_formatted = !!name_formatted && name_formatted.indexOf("/") == name_formatted.length - 1 ? name_formatted.substr(0, name_formatted.length - 1) : name_formatted;
                await page.screenshot({path: "./screenshots/successes/" + name_formatted + ".png"}).catch((e) => {});

            }

        }

        console.log("Origin: " + last_url + "\nLanded: " + page.url());
        if(sequentialErrorCount === 0) {

         console.log("\x1b[32m", "✔ Success", "\x1b[0m");
         
        }
        console.log("\n");

        last_url = href;
        all_handled_urls.push(href); //Add to the list of already-visited urls that we do not want to re-check.

    }

    await HandleRecursiveSubPages();

}
