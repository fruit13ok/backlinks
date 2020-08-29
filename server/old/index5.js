// REQUIREMENTS

// native
const path = require('path');

// 3rd party
const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const bodyParser = require('body-parser');
const fetch = require("node-fetch");
const AbortController = require('abort-controller');
var userAgent = require('user-agents');
var random_useragent = require('random-useragent');

// local
const app = express();
const controller = new AbortController();
const port = process.env.PORT || 8000;

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

// return single promise result as array of objects
const urlLoop = async (urls) => {
    // wait for non-responsive url for at least 1 second, 
    // less than that could mistreat good url
    let waitTime = 10000;
    setTimeout(() => { controller.abort(); }, waitTime);
    // check URL status code return array of fetches promise
    let checkUrl = urls.map(url => fetch(url, {
        signal: controller.signal
      })
      .then(function(response) {
        return {url: url, status: response.status.toString()};
      })
      .catch(function(error) {
        if (error.name === 'AbortError') {
          console.log('Got AbortError', url)
          return {url: url, status: "408 Request Timeout "+waitTime+"ms"};
        } else {
          throw error;
        }
      })
    );
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
    const browser = await puppeteer.launch({
        headless: false,
        slowMo: 100
    });
    const page = await browser.newPage();
    await page.goto('https://www.google.com/');
    await page.type('input[title="Search"]', searchKey, { delay: 50 });
    await page.keyboard.press('Enter');
    await page.waitForNavigation();

    await page.waitForSelector('a#hdtb-tls');
    await page.click('a#hdtb-tls');
    await page.waitForSelector('[aria-label="All results"]');
    await page.click('[aria-label="All results"]');
    await page.waitForSelector('ul > li#li_1 > a.q.qs');
    await page.click('ul > li#li_1 > a.q.qs');

    // await page.waitForSelector('#rso > .g > .rc > .r > a');
    await page.waitForNavigation();

    let hasNext = true
    while(hasNext) {
      const searchResults = await page.$$('h3.LC20lb');
      for (let result of searchResults) {
          let title = await (await result.getProperty('textContent')).jsonValue();
          console.log(title);
      }
      let nextLink = await page.$('a[id="pnnext"]');
      if (nextLink !== null) {
          await nextLink.click();
          await page.waitForNavigation();
      } else {
          hasNext = false;
      }
    }
    await browser.close();
    // return new Promise(async (resolve, reject) => {
    //     try {
    //         // const browser = await puppeteer.launch();
    //         const browser = await puppeteer.launch({ headless: false, slowMo: 100 });
            
    //         const page = await browser.newPage();
    //         page.setDefaultNavigationTimeout( 90000 );
    //         // await page.goto(`https://www.google.com/`, {
    //         //     waitUntil: 'networkidle0'
    //         // });
    //         await page.goto(`https://www.google.com/`, {
    //             waitUntil: 'domcontentloaded',
    //             timeout: 0
    //         });
    //         // enter search key, select verbatim,
    //         // each step need to wait for page content to load
    //         await page.type('.gLFyf.gsfi', searchKey);
    //         await page.click('input.gNO89b');
    //         await page.waitForSelector('a#hdtb-tls');
    //         await page.click('a#hdtb-tls');
    //         await page.waitForSelector('[aria-label="All results"]');
    //         await page.click('[aria-label="All results"]');
    //         await page.waitForSelector('ul > li#li_1 > a.q.qs');
    //         await page.click('ul > li#li_1 > a.q.qs');

    //         await page.waitForSelector('#rso > .g > .rc > .r > a');

    //         let urls = [];
    //         let hasnext = true;
    //         // loop to collect result urls from each pages
    //         // while (hasnext) {
    //         while (await page.$('a#pnnext') !== null) {
    //             // collect url results from current page
    //             let newUrls = await page.evaluate(() => {
    //                 let hrefs = [];
    //                 let nodeLists = document.querySelectorAll('#rso > .g > .rc > .r > a');
    //                 nodeLists.forEach((nodeList) => {
    //                     hrefs.push(nodeList.getAttribute('href'));
    //                 });
    //                 return hrefs;
    //             });
    //             urls = urls.concat(newUrls);
    //             // if there is next button press it, else end the loop
    //             if (await page.$('a#pnnext') !== null) {
    //                 await Promise.all([
    //                     // await page.waitForNavigation({ waitUntil: 'networkidle2' }),
    //                     await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 0 }),
    //                     await page.click('a#pnnext'),
    //                     await page.waitForSelector('#rso > .g > .rc > .r > a')
    //                 ])
    //             }else{
    //                 hasnext = false;
    //             }
    //         }
    //         // close browser when done
    //         browser.close();
    //         // return promise
    //         return resolve(urls);
    //     } catch (e) {
    //         return reject(e);
    //     }
    // })
};

// ROUTES
// root
app.get('/', function (req, res) {
    res.send('hello world');
});

// post, get form data from frontend
// return array of object with searchKey and count to frontend
app.post('/api', async function (req, res) {
    // req.setTimeout(0);
    let searchKey = req.body.searchKey || "";
    // let startResultNumber = 0;
    // //
    // let result = [{ url: '', status: '' }];
    // let allResult = [];
    // let tryLoop = async () => {
    //     while (result.length) {
    //         //
    //         await scrape(searchKey, startResultNumber)
    //         .then((resultArr)=>{
    //             forLoop(resultArr)
    //             .then(resultArray => {
    //                 // append to all result
    //                 console.log("resultArray", resultArray);
    //                 allResult = [...allResult,...resultArray];
    //                 // loop control
    //                 result = [...resultArray];
    //                 // result = []; // test loop once
    //                 startResultNumber=startResultNumber+10;
    //             })
    //         }).catch(() => {});
    //     }
    //     return allResult;
    // }
    // tryLoop()
    // .then((rlist) => {
    //     console.log('list end: ', rlist);
    //     res.send(removeDuplicateResult(rlist));
    // });
    scrape("symphysismarketing.com")
    .then((urls)=>{
        console.log(urls);
        res.send(urls);
        // // console.log("testing1");
        // urlLoop(urls)      // new version, take care bad url
        // .then((resultArray) => {
        //     // console.log("testing3");
        //     console.log(resultArray);
        //     res.send(removeDuplicateResult(resultArray));
        // })
        // .catch((err)=>{
        //     console.error(err)
        // });
    })
    .catch((err)=>{
        console.error(err)
    });
});

// scrape("symphysismarketing.com")
// .then((urls)=>{
//     console.log(urls);
//     // console.log("testing1");
//     urlLoop(urls)      // new version, take care bad url
//     .then((resultArray) => {
//         // console.log("testing3");
//         console.log(resultArray);
//     })
//     .catch((err)=>{
//         console.error(err)
//     });
// })
// .catch((err)=>{
//     console.error(err)
// });