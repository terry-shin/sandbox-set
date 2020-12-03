//express
const express = require("express");
const app = express();

// output処理用
const fs = require("fs");

// html解析用
const HTMLParser = require('fast-html-parser');

// log4js setting
const log4js = require("log4js");
log4js.configure('./work/config/log4js.config.json');

const appLogger = log4js.getLogger();
const errorLogger = log4js.getLogger('err');
const accessLogger = log4js.getLogger('web');

//bind access log
app.use(log4js.connectLogger(accessLogger));

// outputファイル用　現在日時をセット
require('date-utils');
const dt = new Date();
const formatted = dt.toFormat('YYYYMMDDHH24MISS');

// 環境変数にprotの指定がなければ8080使う
const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0';

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}...`);
});

// index
app.get("/", (req, res) => {
  res.send('Hello World');
});


// ここからcrawl関連
// puppeteer
const puppeteer = require('puppeteer');

// Cloudstrage
const {Storage} = require('@google-cloud/storage');
const storage = new Storage();
const myBucket = storage.bucket('test_mori_bucket');

// get page_title
const getTitle = async page => {
  return await page.title()
}

// get screenshot
const getScreenShot = async page => {
  let buffer = await page.screenshot({fullPage: true});
  return buffer;
}

//  screenshot save to LOCAL
const getScreenShotLocal = async page => {
  console.log(`save ScreenShot to LOCAL:START`);
  await page.screenshot({
      path: `./output/${formatted}_screenshot.png`,
      fullPage: true
  });
  console.log(`save ScreenShot to LOCAL:END`);
}

// save to CloudStrage
const saveStrage = buffer => {
  let file = myBucket.file(`${formatted}_screenshot.png`);
  file.save(buffer, { metadata: { contentType: 'image/png' } }).then(function() {});
}

// innerHTML save to LOCAL
const getHtmlLocal = async page => {
  console.log(`save innerHTML to LOCAL:START`);
  let html = await page.evaluate(() => { return document.getElementsByTagName('html')[0].innerHTML });

  await fs.writeFileSync(`./output/${formatted}_test.html`, html);
  console.log(`save innerHTML to LOCAL:END`);
}

const makeMsg = title => {
  console.log(`access:${title}`);
}

const sendError = err => {
  console.log(`error:${err}`);
}

//キーワードクロール
const wrap = fn => (...args) => fn(...args).catch(args[2]);

app.get("/crawl", wrap(async (req, res, next) => {
  appLogger.info("crawl START");

  var outputJson;

  //get input_parameter
  var keyword = req.query.k;
  appLogger.info(`input keyword:${keyword}`);
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

  //ページ取得
  await page.goto(encodeURI(`https://www.amazon.co.jp/s?k=${keyword}&__mk_ja_JP=%E3%82%AB%E3%82%BF%E3%82%AB%E3%83%8A&ref=nb_sb_noss`), {waitUntil: ["domcontentloaded", "networkidle0"]});

  //タイトル取得
  getTitle(page).then(makeMsg).catch(sendError)

  //スクショ & html取得
  appLogger.info(`get screenshot & html`);
  //google strageへ 環境によって分ける
  //await getScreenShot(page).then(saveStrage).catch(sendError)
  await getScreenShotLocal(page)
  await getHtmlLocal(page)

  // TOP&BOTTOM 広告枠取得
  let adElems = await page.$$("span[data-component-type='s-ads-metrics'");
  for(let i=0; i < adElems.length; i++){

    // TOP AD check
    headElems = await adElems[i].$$("div._multi-card-creative-desktop_DesktopContainer_content__EgtBX");
    if(headElems.length <= 0){
      headElems = await adElems[i].$$("div[data-cel-widget='MultiCardCreativeDesktop']");
    }
    if(headElems.length > 0){
      appLogger.info("===================");
      appLogger.info("TOP AD list");
      appLogger.info("===================");
      // asin 取得
      for(let s=0; s < headElems.length; s++){
        let asinList = await headElems[s].$$eval("div[data-asin]", elements => {
          return elements.map(data => data.getAttribute('data-asin'))
        });

        for(let x=0; x < asinList.length; x++){
          let asinItme = null;
          let productName = null;

          asinItem = await headElems[s].$(`div[data-asin='${asinList[x]}'] > div > a > span`);
          if(!asinItem){
            asinItem = await headElems[s].$("div[data-asin] span[data-click-el='title']");
          }
          if(asinItem){
            productName = await (await asinItem.getProperty('textContent')).jsonValue();
          }else{
            productName = "該当なし";
          }

          let addData = {asin : asinList[x], name : productName}
          appLogger.info(addData);
        }
      }
    }

    //BOTTOM 広告枠チェック
    bottomElems = await adElems[i].$$("div.threepsl-creative")
    if(bottomElems.length > 0){
      appLogger.info("===================");
      appLogger.info("BOTTOM AD list");
      appLogger.info("===================");
      for(let s=0; s < bottomElems.length; s++){
        let productItem = null;
        let productName = null;
        let linkItem = null;
        let productLink = null;

        //名前取得
        productItem = await bottomElems[s].$("div[data-headline] > span > span");
        if(productItem){
          productName = await (await productItem.getProperty('textContent')).jsonValue()
        }

        //リンク
        linkItem = await bottomElems[s].$("div > a");
        if(linkItem){
          productLink = await (await linkItem.getProperty('href')).jsonValue()
        }

        let addData = {name : productName, link : productLink}
        appLogger.info(addData);
      }
    }
  }

  //検索結果内AD 取得
  appLogger.info("===================");
  appLogger.info("AD list");
  appLogger.info("===================");

  let asinList = await page.$$eval(`div[data-asin] + div[class~='AdHolder']`, elementList => {
    var datas=[];

    for (let i = 0; i < elementList.length; i++) {
      var data = {
        asin: elementList[i].getAttribute('data-asin'),
        elementbody: elementList[i].innerHTML
      };
      datas.push(data);
    }
    return datas;
  });

  asinList.forEach(function( value ) {
    let doc = HTMLParser.parse(value.elementbody);
    let productNode = doc.querySelector('h2 a span')

    //ToDo:json形式に整形
    let addData = {asin : value.asin, name : productNode.lastChild.text}
    appLogger.info(addData);
  });

  browser.close();
  res.status(200).send(`END:${formatted}`);
}));
