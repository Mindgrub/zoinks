### zoinks
Website testing tool - Finds non-200 responses, SSL errors, Javascript errors and more!

### Download:
npm install zoinks

### Run:
zoinks MyWebsite.com

### - Options -
**--haslogin** *(bool)* Sets flag telling runner to log-in to a provided account before crawling.
**--takescreenshotseverypage** *(bool)* Take a screenshot on successful page loads, in addition to the failed ones.
**--failonjavascripterror** *(bool)* Fail a page check if a Javascript error is detected in the browser console.
**--addbase** *(comma-delimited list of strings)* Additional base urls in anchor tags that will not be ignored if found on website while scraping.
**--ignorepaths** *(comma-delimited list of strings)* Urls containing these paths will not be checked by the runner.
**--loginpath** *(string)* The path, excluding base url, to the supplied website's log-in form. Ignored if `haslogin` not provided.
**--protocol** *(string)* Https (default) or http.
**--username** *(string)* Username or email to log in with. Ignored if `haslogin` not provided.
**--password** *(string)* User password to log in with. Ignored if `haslogin` not provided.
**--contentloadselector** *(string)* Css selector that will locate an element on the page that would only exist if page load has completed. This selector must be available on all pages. If not provided, content load check will not be performed.
**--maxsequentialerrors** *(number)* The number of sequential failed tests before exiting test early on suspicion of website being down. This is primarily for fast failing when zoinks is being used for CI health checks. Default is 2. This means that 2 concurrent failures after the initial error will cause an early exit.
**--loginconfirmedselector** *(string)* Css selector that will locate an element on the page that would only exist if user has successfully logged in.
**--usernameinputselector** *(string)* Css selector that will locate the username/email field on a website's log-in page.
**--passwordinputselector** *(string)* Css selector that will locate the password field on a website's log-in page.
**--loginbuttonselector** *(string)* Css selector that will locate the log-in button on a website's log-in page.
