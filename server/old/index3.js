const puppeteer = require('puppeteer');
function scrape (searchKey) {
    return new Promise(async (resolve, reject) => {
        try {
            // const browser = await puppeteer.launch();
            const browser = await puppeteer.launch({ headless: false });
            const page = await browser.newPage();
            // await page.goto("https://news.ycombinator.com/");

            // await page.goto("https://www.google.com/search?q=%22homemade+souffle+pancake%22", {
            //     waitUntil: 'networkidle0'
            // });

            await page.goto(`https://www.google.com/search?q=${searchKey}`, {
                waitUntil: 'networkidle0'
            });
            let currentPage = 1;
            let urls = [];
            let hasnext = true;
            // while (currentPage <= pagesToScrape) {
            while (hasnext) {
                let newUrls = await page.evaluate(() => {
                    let results = [];
                    // let items = document.querySelectorAll('a.storylink');
                    let items = document.querySelectorAll('#rso > .g > .rc > .r > a');
                    items.forEach((item) => {
                        results.push({
                            url:  item.getAttribute('href'),
                            text: item.innerText,
                        });
                    });
                    return results;
                });
                urls = urls.concat(newUrls);
                // if (currentPage < pagesToScrape) {
                if (await page.$('a#pnnext') !== null) {
                    await Promise.all([
                        page.waitForNavigation({ waitUntil: 'networkidle2' }),
                        // await page.click('a.morelink'),
                        await page.click('a#pnnext'),
                        // await page.waitForSelector('a.storylink')
                        await page.waitForSelector('#rso > .g > .rc > .r > a')
                    ])
                }else{
                    hasnext = false;
                }
                currentPage++;
            }
            // browser.close();
            return resolve(urls);
        } catch (e) {
            return reject(e);
        }
    })
}
scrape('"homemade souffle pancake"').then(console.log).catch(console.error);