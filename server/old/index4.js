const puppeteer = require('puppeteer');
// const cors = require('cors');
const fetch = require("node-fetch");
const AbortController = require('abort-controller');
const controller = new AbortController();
//
// // check URL status code
// let checkUrl = async (url) => {
//     try {
//         const response = await fetch(url);
//         const status = await response.status;
//         return status.toString();
//     }catch (error) {
//         console.log(error);
//         return error;
//     }
// };
// // return result array of objects
// let forLoop = async (resultArr) => {
//     console.log("testing2");
//     let resultArray = [];
//     for (let i = 0; i < resultArr.length; i++) {
//         let curUrl = resultArr[i];
//         let curStatus = await checkUrl(curUrl);
//         resultArray.push({url: curUrl, status: curStatus});
//         // resultArray.push({url: curUrl});
//     }
//     return resultArray;
// }

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

//
async function scrape (searchKey) {
    return new Promise(async (resolve, reject) => {
        try {
            // const browser = await puppeteer.launch();
            const browser = await puppeteer.launch({ headless: false, slowMo: 100 });
            const page = await browser.newPage();
            await page.goto(`https://www.google.com/`, {
                waitUntil: 'networkidle0'
            });
            // enter search key, select verbatim,
            // each step need to wait for page content to load
            await page.type('.gLFyf.gsfi', searchKey);
            await page.click('input.gNO89b');
            await page.waitForSelector('a#hdtb-tls');
            await page.click('a#hdtb-tls');
            await page.waitForSelector('[aria-label="All results"]');
            await page.click('[aria-label="All results"]');
            await page.waitForSelector('ul > li#li_1 > a.q.qs');
            await page.click('ul > li#li_1 > a.q.qs');

            await page.waitForSelector('#rso > .g > .rc > .r > a');

            let urls = [];
            let hasnext = true;
            // loop to collect result urls from each pages
            while (hasnext) {
                // collect url results from current page
                let newUrls = await page.evaluate(() => {
                    let hrefs = [];
                    let nodeLists = document.querySelectorAll('#rso > .g > .rc > .r > a');
                    nodeLists.forEach((nodeList) => {
                        hrefs.push(nodeList.getAttribute('href'));
                    });
                    return hrefs;
                });
                urls = urls.concat(newUrls);
                // if there is next button press it, else end the loop
                if (await page.$('a#pnnext') !== null) {
                    await Promise.all([
                        page.waitForNavigation({ waitUntil: 'networkidle2' }),
                        await page.click('a#pnnext'),
                        await page.waitForSelector('#rso > .g > .rc > .r > a')
                    ])
                }else{
                    hasnext = false;
                }
            }
            // close browser when done
            browser.close();
            // return promise
            return resolve(urls);
        } catch (e) {
            return reject(e);
        }
    })
}
scrape("symphysismarketing.com")
.then((urls)=>{
    console.log(urls);
    // console.log("testing1");
    // forLoop(urls)   // old version
    // urlLoop(urls)      // new version, take care bad url
    // .then((resultArray) => {
    //     // console.log("testing3");
    //     console.log(resultArray);
    // })
    // .catch((err)=>{
    //     console.error(err)
    // });
})
.catch((err)=>{
    console.error(err)
});