// REQUIREMENTS

// native
const path = require('path');
const https = require('https');

// 3rd party
const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const bodyParser = require('body-parser');
const fetch = require("node-fetch");
const AbortController = require('abort-controller');
// random user info for frequent request / recaptcha
var userAgent = require('user-agents');
var random_useragent = require('random-useragent');

// local
const app = express();
const controller = new AbortController();
const port = process.env.PORT || 8000;

// [SOLUTION] to node-fetch problem, work together with abort request, and catch block,
// FetchError Hostname/IP does not match certificate's altnames ERR_TLS_CERT_ALTNAME_INVALID
// TypeError ERR_INVALID_PROTOCOL
process.env.NODE_TLS_REJECT_UNAUTHORIZED = false;
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;
const agent = new https.Agent({
    rejectUnauthorized: false,
    // keepAlive: true,
    // maxSockets: 100,
});

// MIDDLEWARE
app.use(express.static(path.join(__dirname, '../public')));
app.use('/css', express.static(__dirname + '../node_modules/bootstrap/dist/css'));
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// allow cors to access this backend
app.use( (req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

// INIT SERVER
app.listen(port, () => {
    console.log(`Started on port ${port}`);
});

// helper functions

// return links from current page, use in a loop to accumulate all page links
// fix short for result problem, 
// by convert for loop to async function to wait
const forLoop = async (resultElements) => {
    var tempArr=[];
    for (let resultElement of resultElements) {
        let url = await (await resultElement.getProperty('href')).jsonValue();
        let aText = await resultElement.$eval('h3', i => i.innerText);
        console.log(url);
        console.log(aText);
        // urls.push(url);
        tempArr.push({url: url, aText: aText});
    }
    return tempArr;
}

// convert to start with https://
const tohttps = (url) => {
    let newurl;
    if(url.startsWith('https://www.')){
        newurl='https://'+url.slice(12);
    }else if(url.startsWith('https://')){
        newurl=url;
    }else if(url.startsWith('http://www.')){
        newurl='https://'+url.slice(11);
    }else if(url.startsWith('http://')){
        newurl='https://'+url.slice(7);
    }else if(url.startsWith('www.')){
        newurl='https://'+url.slice(4);
    }else{
        newurl='https://'+url;
    }
    // console.log(newurl);
    return newurl;
};

// return single promise result as array of objects
const urlLoop = async (urls) => {
    // wait for non-responsive url for at least 1 second, 
    // less than that could mistreat good url
    let waitTime = 5000;
    setTimeout(() => { controller.abort(); }, waitTime);
    // check URL status code return array of fetches promise
    // let checkUrl = urls.map(url => fetch(tohttps(url), {
        // for(const e of urls){
        //     console.log('--',e.url);
        // }

    // let checkUrl = urls.map(e => fetch(tohttps(e.url), {
    //         signal: controller.signal,
    //         agent: agent
    //     })
    let checkUrl = urls.map(e => {
        return fetch(tohttps(e.url), {
            signal: controller.signal,
            agent: agent
        })
        .then(function(response) {
            if (response.status.toString() == '999') {
                return {url: e.url, status: '999 not permit scanning', anchorText: e.aText};
            }
            else {
                return {url: e.url, status: response.status.toString(), anchorText: e.aText};
            }
        })
        .catch(function(error) {
            if (error.name === 'AbortError') {
                // console.log('Got AbortError', e.url);
                return {url: e.url, status: "408 Request Timeout", anchorText: e.aText};
            }
            else if (error.name === 'FetchError' && error.code === 'EPROTO'){
                // console.log('Got FetchError', e.url);
                return {url: e.url, status: "200 http only", anchorText: e.aText};
            }
            else if (error.name === 'FetchError' && error.code === 'ECONNRESET'){
                // console.log('Got FetchError', e.url);
                return {url: e.url, status: "408 Connection Reset", anchorText: e.aText};
            }
            else if (error.name === 'FetchError' && error.code === 'ECONNREFUSED'){
                // console.log('Got FetchError', e.url);
                return {url: e.url, status: "503 Service Unavailable", anchorText: e.aText};
            }
            else if (error.name === 'FetchError' && error.code === 'ENOTFOUND'){
                // console.log('Got FetchError', e.url);
                return {url: e.url, status: "404 Not Found", anchorText: e.aText};
            }
            else if (error.name === 'TypeError' || error.name === 'TypeError [ERR_INVALID_PROTOCOL]'){
                // console.log('Got TypeError', e.url);
                return {url: e.url, status: "200", anchorText: e.aText};
            }
            else {  // new future unidentify error
                console.log("my error:",error);
                // console.log("my url:",e.url);
                throw error;
            }
        })
    });
    // loop over array of all promises resolves them, 
    // return single promise as array result
    let results = await Promise.all(checkUrl);
    return results;
};

// not in use
// don't know why check and add unique result increase recaptcha to appear
// return new all result, should deep copy to replace old all result
let addUniqueResult = (allResult, newResult) => {
    let tempResult = [...allResult];
    let isDuplicate = false;
    // outer loop new results, inner loop all results
    // if new result is duplicate, skip
    // if new result is unique, push to all results
    for (let i = 0; i < newResult.length; i++) {
        for (let j = 0; j < tempResult.length; j++) {
            if (tempResult[j].id == newResult[i].id) {
                isDuplicate = true;
                break;
            }
        }
        if (!isDuplicate) {
            tempResult.push(newResult[i]);
        } else {
            isDuplicate = false;
        }
    }
    return tempResult;
}

// as alternative to addUniqueResult() remove duuplicate at the end
let removeDuplicateResult = (allResult) => {
    const seen = new Set();
    const filteredArr = allResult.filter(el => {
        const duplicate = seen.has(el.url);
        seen.add(el.url);
        return !duplicate;
    });
    return filteredArr;
}

// scrape
async function scrape (searchKey) {
    const blockedResourceTypes = ['image','media','font','stylesheet'];
    // const browser = await puppeteer.launch({args: ['--no-sandbox', '--disable-setuid-sandbox', '--blink-settings=imagesEnabled=false'], slowMo: 100});   // this might not work
    const browser = await puppeteer.launch({headless: false, slowMo: 100});
    // const browser = await puppeteer.launch({slowMo: 100}); // need to slow down to content load

    const page = await browser.newPage();
    // deal with navigation and page timeout, see the link
    // https://www.checklyhq.com/docs/browser-checks/timeouts/
    const navigationPromise =  page.waitForNavigation();
    
    await page.setUserAgent(userAgent.random().toString());

    await page.setRequestInterception(true);
    page.on('request', (request) => {
        if(blockedResourceTypes.indexOf(request.resourceType()) !== -1){
            request.abort();
        }
        else {
            request.continue();
        }
    });

    await page.goto('https://www.google.com/');
    await navigationPromise;
    await page.type('input[title="Search"]', searchKey, { delay: 50 });
    // await page.type('input[title="Search"]', searchKey);
    await page.keyboard.press('Enter');
    await navigationPromise;

    await page.waitForSelector('a#hdtb-tls');

    await page.click('a#hdtb-tls');
    await navigationPromise;
    // google updated their code no longer click on dropdown list by label
    // await page.waitForSelector('div[aria-label="All results"]');
    // await page.click('div[aria-label="All results"]');
    // new way to select and click on dropdown list, by xpath
    // select in chrome with $x("//div[contains(text(), 'All results')]")
    const elements = await page.$x("//div[contains(text(), 'All results')]");
    await elements[0].click();
    await page.waitForSelector('ul > li#li_1');
    await page.click('ul > li#li_1');
    await navigationPromise;

    let pageNum = 0;
    let urls = [];
    let hasNext = true
    while(hasNext) {
        console.log(pageNum);
        pageNum++;
        // google updated their code no longer select DOM like this
        // const arrOfElements = await page.$$('#rso > .g > .rc > .r > a');
        const arrOfElements = await page.$$('div.yuRUbf > a');
        // const arrOfElements = await page.$$('#rso > .g > .rc .yuRUbf > a');
        // need to convert for loop to async function to wait
        // urls.push(...await forLoop(arrOfElements));  // old just array of url
        // urls.push(...await (await forLoop(arrOfElements)).map(result=>result.url));  // ugly
        const arrObj = await forLoop(arrOfElements);
        // const arrUrl = await arrObj.map(result=>result.url);
        // await urls.push(...arrUrl);
        await urls.push(...arrObj);
        let nextLink = await page.$('a[id="pnnext"]');
        if (nextLink !== null) {
            await nextLink.click();
            await page.waitForNavigation();
        } else {
            hasNext = false;
        }
    }
    await browser.close();
    return urls;
};

// ROUTES
// root
app.get('/', function (req, res) {
    res.send('hello world');
});

// post, get form data from frontend
// return array of object with searchKey and count to frontend
app.post('/api', async function (req, res) {
    req.setTimeout(0);
    let searchKey = req.body.searchKey || "";
    const urls = await scrape(searchKey);
    // console.log(urls);
    // res.send(urls);
    urlLoop(urls)
    .then((resultArray) => {
        // console.log(resultArray);
        // res.send(resultArray);
        res.send(removeDuplicateResult(resultArray));
    })
    .catch((err)=>{
        console.error(err)
    });
});
