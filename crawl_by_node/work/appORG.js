const express = require("express");
const app = express();

const fs = require("fs");

// log4js setting
const log4js = require("log4js");
log4js.configure('./work/config/log4js.config.json');

const appLogger = log4js.getLogger();
const errorLogger = log4js.getLogger('err');
const accessLogger = log4js.getLogger('web');


//bind access log
app.use(log4js.connectLogger(accessLogger));

// 環境変数にprotの指定がなければ8080使う
const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0';

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}...`);
});

// index
app.get("/", (req, res) => {
  appLogger.info("test index");
  res.send('Hello World');
});


//ここからcrawl関連
require('date-utils');

const dt = new Date();
var formatted = dt.toFormat('YYYYMMDDHH24MISS');

// puppeteer
const puppeteer = require('puppeteer');

// Cloudstrage
const {Storage} = require('@google-cloud/storage');
const storage = new Storage();
const myBucket = storage.bucket('test_mori_bucket');

const getTitle = page => {
  return page.title()
}

const getScreenShot = async page => {
  let buffer = await page.screenshot({fullPage: true});
  return buffer;
}

const getScreenShotLocal = async page => {
  console.log(`get img start`);
  await page.screenshot({
      path: `./output/${formatted}_screenshot.png`,
      fullPage: true
  });
  console.log(`get img end`);
}

const getHtmlLocal = async page => {
  console.log(`get html start`);
  let html = await page.evaluate(() => { return document.getElementsByTagName('html')[0].innerHTML });

  await fs.writeFileSync(`./output/${formatted}_test.html`, html);
  console.log(`get html end`);
}

const saveStrage = buffer => {
  let file = myBucket.file(`${formatted}_screenshot.png`);
  file.save(buffer, { metadata: { contentType: 'image/png' } }).then(function() {});
}

const makeMsg = title => {
  console.log(`access:${title}`);
}

const sendError = err => {
  console.log(`error:${err}`);
}

//キーワードクロール
app.get("/crawl", async (req, res) => {
  appLogger.info("crawl start");

  //get input_parameter
  var keyword = req.query.k
  appLogger.info(`keyword:${keyword}`);
  if (keyword == "" || keyword === undefined){
    res.status(200).send(`${formatted}：no check END`);
  }

  //puppeteer 前準備
  const browser = await puppeteer.launch({
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--disable-infobars',
      '--disable-application-cache',
      '--ignore-certificate-errors',
      ''
    ],
    defaultViewport: {
      width: 1280,
      height: 1696
    }
  });
  let page = (await browser.pages())[0];

  const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.193 Safari/537.36';
  page.setUserAgent(userAgent);
  await page.goto(encodeURI(`https://www.amazon.co.jp/s?k=${keyword}&__mk_ja_JP=%E3%82%AB%E3%82%BF%E3%82%AB%E3%83%8A&ref=nb_sb_noss`), {waitUntil: ["domcontentloaded", "networkidle0"]});

  //タイトル取得
  getTitle(page).then(makeMsg).catch(sendError)

  //スクショ & html取得
  appLogger.info(`get screenshot & html`);
  //google strageへ 環境によって分ける
  //await getScreenShot(page).then(saveStrage).catch(sendError)
  await getScreenShotLocal(page)
  await getHtmlLocal(page)

  //検索結果部分 取得
  let searchElems = await page.$("div.s-main-slot.s-result-list.s-search-results.sg-row");

  // TOP&BOTTOM 広告枠取得
  let adElems = await searchElems.$$("span[data-component-type='s-ads-metrics'");
  appLogger.info(adElems.length);

  let headElem;
  let bottomElem;
  let asinList;
  let productAsinList;

  for(let i=0; i < adElems.length; i++){

    // TOP AD check
    headElem = await adElems[i].$$("div._multi-card-creative-desktop_DesktopContainer_content__EgtBX");
    if(headElem.length <= 0){
      headElem = await adElems[i].$$("div[data-cel-widget='MultiCardCreativeDesktop']");
    }

    if(headElem.length > 0){
      // asin 取得
      asinList = await headElem[0].$$eval("div[data-asin]", elements => { return elements.map(data => data.getAttribute('data-asin'))});
      appLogger.info(asinList.length);
      appLogger.info(asinList[0]);

      var testX = await headElem[0].$(`div[data-asin='${asinList[0]}'] > div > a > span`);
      if(testX){
        var testZ = await (await testX.getProperty('textContent')).jsonValue();
        appLogger.info(testZ);
      }else{
        var testX = await headElem[0].$("div[data-asin] span[data-click-el='title']");
        if(testX){
          var testZ = await (await testX.getProperty('textContent')).jsonValue();
        }else{
          appLogger.info("該当なし");
        }
      }
    }

    //BOTTOM 広告枠チェック
    bottomElem = await adElems[i].$$("div.threepsl-creative")
    appLogger.info(bottomElem.length);
    for(let s=0; s < bottomElem.length; s++){
      //名前取得
      var span = await bottomElem[s].$("div[data-headline] > span > span");
      var productName = await (await span.getProperty('textContent')).jsonValue()
      appLogger.info(productName);

      //リンク
      span = await bottomElem[s].$("div > a");
      var productLink = await (await span.getProperty('href')).jsonValue()
      appLogger.info(productLink);
    }
  }

  //プロダクト広告取得
  productAsinList = await page.$$eval("div[data-asin] + div[class~='AdHolder']", elements => {
    return elements.map(data => data.getAttribute('data-asin'))
  });
  appLogger.info(productAsinList.length);

  for(let i=0; i < productAsinList.length; i++){
    appLogger.info(productAsinList[i]);
    //var span = await searchElems.$eval("div[data-asin='" + asinList[i] + "']+div[class~='AdHolder'] h2 a span", item => {
    //var span = await page.$eval("div[data-asin='" + asinList[i] + "'] + div[class~='AdHolder']", item => {
    //  return item.innerHTML
    //});
    //var span = await searchElems.$(`div[data-asin='${asinList[i]}'] + div[class~='AdHolder']`);
    //var span = await searchElems.$$eval(`div[data-asin='${asinList[i]}'] + div[class~='AdHolder'] h2 a span`, item => {
    //  return item.innerText
    //});
    var span = await page.$$eval(`div[class~='AdHolder']`, elementsA => {
       return elementsA.map(dataA => dataA.getAttribute('data-asin'))
     });
    appLogger.info(span.length);
    span.forEach(function( value ) {
         appLogger.info(value);
    });
  }

  browser.close();

  res.status(200).send(`END:${formatted}`);
});
