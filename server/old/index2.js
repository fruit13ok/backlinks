// REQUIREMENTS

// native
const path = require('path');

// 3rd party
const express = require('express');
const puppeteer = require('puppeteer');
const bodyParser = require('body-parser');
const fetch = require("node-fetch");
var userAgent = require('user-agents');
var random_useragent = require('random-useragent');

// local
const app = express();
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
// check URL status code
let checkUrl = async (url) => {
    try {
        const response = await fetch(url);
        const status = await response.status;
        return status.toString();
    }catch (error) {
        console.log("fetch error: ",error);
        // return error;
        return "598";
    }
};

// return result array of objects
let forLoop = async (resultArr) => {
    let resultArray = [];
    for (let i = 0; i < resultArr.length; i++) {
        let curUrl = resultArr[i];
        let curStatus = await checkUrl(curUrl);
        resultArray.push({url: curUrl, status: curStatus});
    }
    return resultArray;
}

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
let scrape = async (searchKey, startResultNum) => {
    const blockedResourceTypes = ['image','media','font','stylesheet'];
    let BASE_URL = `https://www.google.com/search?q=${searchKey}&tbs=li:1&start=${startResultNum}`;
    // let BASE_URL = `https://www.google.com/search?q=${searchKey}&tbs=li:1&num=100`;
    // const browser = await puppeteer.launch({args: ['--proxy-server=50.235.149.74:8080', '--no-sandbox', '--disable-setuid-sandbox', '--blink-settings=imagesEnabled=false']});
    const browser = await puppeteer.launch({args: ['--no-sandbox', '--disable-setuid-sandbox', '--blink-settings=imagesEnabled=false']});
    // const browser = await puppeteer.launch({ headless: false, args: ['--proxy-server=50.235.149.74:8080'] });
    const page = await browser.newPage();
    // to bypass recaptcha use "user-agents" to generate random userAgent on each scrape
    // await page.setUserAgent(userAgent.random().toString());
    await page.setUserAgent(random_useragent.getRandom());
    await page.setRequestInterception(true);
    page.on('request', (request) => {
        if(blockedResourceTypes.indexOf(request.resourceType()) !== -1){
            request.abort();
        }
        else {
            request.continue();
        }
    });
    await page.goto(BASE_URL, {
        waitUntil: 'networkidle2'
    });
    //
    // await page.waitFor(3000);
    const result = await page.evaluate(() => {
        let aList = [];
        let elements = document.querySelectorAll('#rso > .g > .rc > .r > a');
        // console.log("elements: ",elements);
        for (var element of elements){
            console.log("element: ", element.href);
            aList.push(element.href);
        }
        return aList;
    });
    // close when is done
    await browser.close();
    return result;
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
    let startResultNumber = 0;
    //
    let result = [{ url: '', status: '' }];
    let allResult = [];
    let tryLoop = async () => {
        while (result.length) {
            //
            await scrape(searchKey, startResultNumber)
            .then((resultArr)=>{
                forLoop(resultArr)
                .then(resultArray => {
                    // append to all result
                    console.log("resultArray", resultArray);
                    allResult = [...allResult,...resultArray];
                    // loop control
                    result = [...resultArray];
                    // result = []; // test loop once
                    startResultNumber=startResultNumber+10;
                })
            }).catch(() => {});
        }
        return allResult;
    }
    tryLoop()
    .then((rlist) => {
        console.log('list end: ', rlist);
        res.send(removeDuplicateResult(rlist));
    });
});