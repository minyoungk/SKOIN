var express = require('express');
var router = express.Router();
var Nightmare = require('nightmare');
var request = require("request");
var Promise = require("bluebird");
var mysql      = require('mysql');
var rp = require('request-promise');
var _ = require('lodash');
const Xvfb = require('xvfb');
const xvfb = new Xvfb();
var moment = require('moment');

var connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'onetw@345',
    database: 'ticket'
});

router.get('/', function(req, res, next) {
    res.render('index', { title: 'Express' });
});

function isValidDate(dateString) {
  var regEx = /^\d{4}-\d{2}-\d{2}$/;
  if(!dateString.match(regEx)) return false;  // Invalid format
  var d = new Date(dateString);
  if(!d.getTime() && d.getTime() !== 0) return false; // Invalid date
  return d.toISOString().slice(0,10) === dateString;
}

/* GET home page. */
router.get('/storeParm', function(req, res, next) {
    var nightmare = Nightmare({ show: true });
    var storedCookies;
    var cookiejar; // 쿠키 정보 저장;
    xvfb.startSync();

    return new Promise(function(resolve,reject){
        return nightmare
            .goto('https://sell.storefarm.naver.com/#/login?url=https:~2F~2Fsell.storefarm.naver.com~2F%23~2Fhome~2Fdashboard')
            .wait('#loginButton')
            .type('#loginId', "ID를 입력해주세요")
            .type('#loginPassword', "PW를 입력해주세요")
            .click('#loginButton')
            .wait(2000)
            .cookies.get()
            .end()
            .then((cookies) => {
                storedCookies = cookies;

                resolve(storedCookies);
            })
            .catch((error) => {
                console.error(error);
            })
        })
        .then(function (re){
            var cookie = "";
            cookiejar = rp.jar();

            for(var i = 0; i < re.length; i++){
                cookie = request.cookie(re[i].name+"="+re[i].value);
                cookiejar.setCookie(cookie,'https://sell.smartstore.naver.com');
            }

            var toDate = moment().format('YYYY.MM.DD')
            var fromDate = moment().subtract(7,'day').format('YYYY.MM.DD');

            var form = {
                'orderStatus': 'ALL',
                'detailedOrderStatus': '',
                'deliveryMethodType': '',
                'deviceClassType': '',
                'delayDispatchGuideTreatStateType': '',
                'detailSearch.type': '',
                'detailSearch.keyword': '',
                'dateRange.type': 'PAY_COMPLETED',
                'dateRange.fromDate': fromDate,
                'dateRange.toDate': toDate,
                'paging.current': '1',
                'rowPerPageType': 'ROW_CNT_100',
                'sort.type': 'RECENTLY_ORDER_YMDT',
                'sort.direction': 'DESC',
                'onlyValidation': 'true',
            };

            var options = {
                uri: "https://sell.smartstore.naver.com/o/n/sale/delivery/json",
                method : "POST",
                jar: cookiejar, // Tells rp to include cookies in jar that match uri
                form: form
            };

            return rp(options)
                .then(function (re){

                    var data = JSON.parse(re);

                    var insert_arr = [];

                    data.htReturnValue.pagedResult.content.forEach( function( v, i ){

                        var status = "";

                        if(v.ORDER_ORDER_STATUS2 == "WAITING_DISPATCH"){
                            status = "신규주문";
                        }else if(v.ORDER_ORDER_STATUS2 == "DELIVERING"){
                            status = "배송중";
                        }else if(v.ORDER_ORDER_STATUS2 == "CANCELED"){
                            status = "취소완료";
                        }else if(v.ORDER_ORDER_STATUS2 == "DELIVERED"){
                            status = "배송완료";
                        }else{
                            status = "취소완료";
                        }

                        if(v.REALTIME_SETTLEMENT_EXPECT_AMOUNT == undefined){
                            v.REALTIME_SETTLEMENT_EXPECT_AMOUNT = 0;
                        }
                        insert_arr.push({
                            'order_no' : v.ORDER_ID,
                            'market_name' : "스토어팜",
                            'status' : status,
                            'item_name' : v.OPRODUCT_ORDER_PRODUCT_PRODUCT_NAME,
                            'order_name' : v.ORDER_ORDER_MEMBER_NAME,
                            'tel' : v.PRODUCT_ORDER_ADDRESS_TELNO1,
                            'price' : v.OPRODUCT_ORDER_PRODUCT_UNIT_PRICE,
                            'count' : v.PRODUCT_ORDER_DETAIL_ORDER_QUANTITY,
                            'item_no' : v.OPRODUCT_ORDER_PRODUCT_PRODUCT_NO,
                            'addr' : v.PRODUCT_ORDER_ADDRESS_ADDRESS,
                            'will_be_price' : v.REALTIME_SETTLEMENT_EXPECT_AMOUNT,
                            'pay_date' : v.ORDER_ORDER_YMDT,
                            'rec_name' : v.PRODUCT_ORDER_ADDRESS_NAME,
                            'order_id' : v.ORDER_ORDER_MEMBER_ID,
                            'product_order_id' : v.PRODUCT_ORDER_ID
                        })
                    });

                    return new Promise.map(insert_arr, function(insert) {
                        return new Promise(function (resolve, reject) {

                            var query = 'insert into marketOrder SET ?' +
                            ' ON DUPLICATE KEY UPDATE status = \'' + insert.status + '\'';

                            connection.query(query, insert, function (error, results, fields) {
                                if (error) throw(error);
                            });

                            resolve(true);
                        })
                    }).then(function(){
                        xvfb.stopSync();
                        res.send('success');
                    })
                })
        })

});

/* 발송처리 */
router.get('/storeParmDlv', function(req, res, next) {
    var nightmare = Nightmare({ show: true });
    var storedCookies;
    var cookiejar; // 쿠키 정보 저장;
    xvfb.startSync();

    return new Promise(function(resolve,reject){
        return nightmare
            .goto('https://sell.storefarm.naver.com/#/login?url=https:~2F~2Fsell.storefarm.naver.com~2F%23~2Fhome~2Fdashboard')
            .wait('#loginButton')
            .type('#loginId', "ID를 입력해주세요")
            .type('#loginPassword', "PW를 입력해주세요")
            .click('#loginButton')
            .wait(2000)
            .cookies.get()
            .end()
            .then((cookies) => {
                storedCookies = cookies;

                resolve(storedCookies);
            })
            .catch((error) => {
                console.error(error);
            })
    })
        .then(function (re){
            var cookie = "";
            cookiejar = rp.jar();

            for(var i = 0; i < re.length; i++){
                cookie = request.cookie(re[i].name+"="+re[i].value);
                cookiejar.setCookie(cookie,'https://sell.smartstore.naver.com');
            }

            return new Promise(function (resolve, reject) {

                var query = 'select product_order_id from marketOrder where market_name = "스토어팜" AND status ="신규주문"';

                connection.query(query, function (error, results, fields) {
                    return resolve(results);
                });


            }).then(function (results){
                var string = JSON.stringify(results);
                var json =  JSON.parse(string);

                if(json.length == 0){
                    res.send("success - nodata");
                    return false;
                }

                return new Promise.map(json, function(v) {
                    return new Promise(function (resolve, reject) {
                        var toDate = moment().format('YYYY.MM.DD')

                        var form = {
                            'dispatchForms[0].productOrderId': v.product_order_id,
                            'dispatchForms[0].deliveryMethodType': 'NOTHING',
                            'dispatchForms[0].searchOrderStatusType': 'WAITING_DISPATCH',
                            'dispatchForms[0].dispatchYmdt': toDate,
                            'checkValidation': 'true',
                            'validationSuccess': 'true',
                        };

                        var options = {
                            uri: "https://sell.smartstore.naver.com/o/sale/delivery/dispatch2",
                            method : "POST",
                            jar: cookiejar, // Tells rp to include cookies in jar that match uri
                            form: form
                        };

                        return rp(options)
                            .then(function (re){
                                res.send('success');
                            })

                    })
                }).then(function(){
                    xvfb.stopSync();
                })
            })

        })

});

/* 11번가 주문 가져오기 */
router.get('/11stNew', function(req, res, next) {
    var nightmare = Nightmare({ show: true });
    var storedCookies;
    var cookiejar; // 쿠키 정보 저장;
    xvfb.startSync();

    return new Promise(function(resolve,reject){
        return nightmare
            .goto('https://login.soffice.11st.co.kr/login/Login.page?returnURL=http%3A%2F%2Fsoffice.11st.co.kr%2FIndex.tmall')
            .wait('#loginName')
            .type('#loginName', "ID를 입력주세요")
            .type('#passWord', "PW를 입력해주세요")
            .click('.btn_login')
            .wait(2000)
            .cookies.get()
            .end()
            .then((cookies) => {
                storedCookies = cookies;

                resolve(storedCookies);
            })
            .catch((error) => {
                console.error(error);
            });
    })
        .then(function (re){

            var cookie = "";
            cookiejar = rp.jar();

            for(var i = 0; i < re.length; i++){
                cookie = request.cookie(re[i].name+"="+re[i].value);
                cookiejar.setCookie(cookie,'https://soffice.11st.co.kr/');
            }

            var toDate = moment().format('YYYYMMDD')
            var fromDate = moment().subtract(7,'day').format('YYYYMMDD');

            var form = {
                'method': 'getOrderLogisticsList',
                'listType': 'orderingLogistics',
                'start': 0,
                'limit': 3000,
                'shDateType': '01',
                'shDateFrom': fromDate,
                'shDateTo': toDate,
                'shBuyerType': '',
                'shBuyerText': '',
                'shProductStat': 202,
                'shDelayReport': '',
                'shPurchaseConfirm': '',
                'shGblDlv': 'N',
                'prdNo': '',
                'shStckNo': '',
                'shOrderType': 'on',
                'addrSeq': '',
                'isAbrdSellerYn': '',
                'abrdOrdPrdStat': '',
                'isItalyAgencyYn': '',
                'shErrYN': '',
                'gblRcvrNm': '%EA%B8%80%EB%A1%9C%EB%B2%8C%ED%86%B5%ED%95%A9%EB%B0%B0%EC%86%A1%EC%A7%80',
                'gblRcvrMailNo': 413853,
                'gblRcvrBaseAddr': '%EA%B2%BD%EA%B8%B0%EB%8F%84%20%ED%8C%8C%EC%A3%BC%EC%8B%9C%20%EA%B4%91%ED%83%84%EB%A9%B4%20%EC%B0%BD%EB%A7%8C%EB%A6%AC%20%20\n' +
                'gblRcvrDtlsAddr: %EA%B2%BD%EA%B8%B0%EB%8F%84%20%ED%8C%8C%EC%A3%BC%EC%8B%9C%20%EA%B4%91%ED%83%84%EB%A9%B4%20%EC%B0%BD%EB%A7%8C%EB%A6%AC%20149-6%EB%B2%88%EC%A7%80%20%EC%A0%84%EC%84%B8%EA%B3%84%5BEMS%5D%EB%B0%B0%EC%86%A1%20%EB%8B%B4%EB%8B%B9%EC%9E%90',
                'gblRcvrTlphn': '31-945-3792',
                'gblRcvrPrtblNo': '000-000-0000',
                'shOrdLang': '',
                'shDlvClfCd': '',
                'shVisitDlvYn': 'N',

            };

            var options = {
                uri: "https://soffice.11st.co.kr/escrow/OrderingLogisticsAction.tmall",
                method : "POST",
                jar: cookiejar, // Tells rp to include cookies in jar that match uri
                form: form
            };

            return rp(options)
                .then(function (re){
                    var data = JSON.parse(re);

                    var insert_arr = [];

                    data.orderingLogistics.forEach( function( v, i ){
                        var tels = v.PRD_OPT_NM.split(":");
                        tels = tels[1].split("-");
                        if(tels.length > 3){
                            tel = tels[0]+"-"+tels[1]+"-"+tels[2];
                        }else{
                            var tel = tels[0].replace(/[^0-9]/g,"");
                            tel = tel.replace(/(^02.{0}|^01.{1}|[0-9]{3})([0-9]+)([0-9]{4})/,"$1-$2-$3");

                            if(tel == ""){
                                tel = v.RCVR_PRTBL_NO
                            }
                        }

                        insert_arr.push({
                            'order_no' : v.ORD_NO_VIEW.replace(/<(\/)?([a-zA-Z]*)(\s[a-zA-Z]*=[^>]*)?(\s)*(\/)?>/ig, ""),
                            'market_name' : "11번가",
                            'status' : "신규주문",
                            'item_name' : v.PRD_OPT_NM,
                            'order_name' : v.RCVR_NM,
                            'tel' : tel,
                            'price' :  v.SEL_PRC.replace(/[^0-9]/g,''),
                            'count' : v.ORD_QTY,
                            'item_no' : v.PRD_NO,
                            'addr' : v.RCVR_BASE_ADDR,
                            'will_be_price' : v.SEL_FEE_AMT.replace(/[^0-9]/g,''),
                            'pay_date' : v.ORD_STL_END_DT,
                            'rec_name' : v.RCVR_NM,
                            'dlv_no' : v.DLV_NO,
                            // 'order_id' : v.ORDER_ORDER_MEMBER_ID
                        })
                    });

                    return new Promise.map(insert_arr, function(insert) {
                        return new Promise(function (resolve, reject) {

                            var query = 'insert into marketOrder SET ?' +
                                ' ON DUPLICATE KEY UPDATE status = \'' + insert.status + '\'';

                            connection.query(query, insert, function (error, results, fields) {
                                if (error) throw(error);
                            });

                            resolve(true);
                        })
                    }).then(function(){
                        xvfb.stopSync();
                        res.send('SUCCESS');
                    })
                })
        })

});

/* 11번가 주문 가져오기 */
router.get('/11st', function(req, res, next) {
    var nightmare = Nightmare({ show: true });
    var storedCookies;
    var cookiejar; // 쿠키 정보 저장;
    xvfb.startSync();

    return new Promise(function(resolve,reject){
        return nightmare
            .goto('https://login.soffice.11st.co.kr/login/Login.page?returnURL=http%3A%2F%2Fsoffice.11st.co.kr%2FIndex.tmall')
            .wait('#loginName')
            .type('#loginName', "ID를 입력주세요")
            .type('#passWord', "PW를 입력해주세요")
            .click('.btn_login')
            .wait(2000)
            .cookies.get()
            .end()
            .then((cookies) => {
                storedCookies = cookies;

                resolve(storedCookies);
            })
            .catch((error) => {
                console.error(error);
            });
    })
        .then(function (re){

            var cookie = "";
            cookiejar = rp.jar();

            for(var i = 0; i < re.length; i++){
                cookie = request.cookie(re[i].name+"="+re[i].value);
                cookiejar.setCookie(cookie,'https://soffice.11st.co.kr/');
            }

            var toDate = moment().format('YYYYMMDD')
            var fromDate = moment().subtract(7,'day').format('YYYYMMDD');

            var form = {
                'method': 'getOrderLogisticsList',
                'listType': 'orderingLogistics',
                'start': 0,
                'limit': 3000,
                'shDateType': '01',
                'shDateFrom': fromDate,
                'shDateTo': toDate,
                'shBuyerType': '',
                'shBuyerText': '',
                'shProductStat': 401,
                'shDelayReport': '',
                'shPurchaseConfirm': '',
                'shGblDlv': 'N',
                'prdNo': '',
                'shStckNo': '',
                'shOrderType': 'on',
                'addrSeq': '',
                'isAbrdSellerYn': '',
                'abrdOrdPrdStat': '',
                'isItalyAgencyYn': '',
                'shErrYN': '',
                'gblRcvrNm': '%EA%B8%80%EB%A1%9C%EB%B2%8C%ED%86%B5%ED%95%A9%EB%B0%B0%EC%86%A1%EC%A7%80',
                'gblRcvrMailNo': 413853,
                'gblRcvrBaseAddr': '%EA%B2%BD%EA%B8%B0%EB%8F%84%20%ED%8C%8C%EC%A3%BC%EC%8B%9C%20%EA%B4%91%ED%83%84%EB%A9%B4%20%EC%B0%BD%EB%A7%8C%EB%A6%AC%20%20\n' +
                'gblRcvrDtlsAddr: %EA%B2%BD%EA%B8%B0%EB%8F%84%20%ED%8C%8C%EC%A3%BC%EC%8B%9C%20%EA%B4%91%ED%83%84%EB%A9%B4%20%EC%B0%BD%EB%A7%8C%EB%A6%AC%20149-6%EB%B2%88%EC%A7%80%20%EC%A0%84%EC%84%B8%EA%B3%84%5BEMS%5D%EB%B0%B0%EC%86%A1%20%EB%8B%B4%EB%8B%B9%EC%9E%90',
                'gblRcvrTlphn': '31-945-3792',
                'gblRcvrPrtblNo': '000-000-0000',
                'shOrdLang': '',
                'shDlvClfCd': '',
                'shVisitDlvYn': 'N',

            };

            var options = {
                uri: "https://soffice.11st.co.kr/escrow/OrderingLogisticsAction.tmall",
                method : "POST",
                jar: cookiejar, // Tells rp to include cookies in jar that match uri
                form: form
            };

            return rp(options)
                .then(function (re){
                    var data = JSON.parse(re);

                    var insert_arr = [];

                    data.orderingLogistics.forEach( function( v, i ){
                        var tels = v.PRD_OPT_NM.split(":");
                        tels = tels[1].split("-");
                        if(tels.length > 3){
                            tel = tels[0]+"-"+tels[1]+"-"+tels[2];
                        }else{
                            var tel = tels[0].replace(/[^0-9]/g,"");
                            tel = tel.replace(/(^02.{0}|^01.{1}|[0-9]{3})([0-9]+)([0-9]{4})/,"$1-$2-$3");

                            if(tel == ""){
                                tel = v.RCVR_PRTBL_NO
                            }
                        }



                        insert_arr.push({
                            'order_no' : v.ORD_NO_VIEW.replace(/<(\/)?([a-zA-Z]*)(\s[a-zA-Z]*=[^>]*)?(\s)*(\/)?>/ig, ""),
                            'market_name' : "11번가",
                            'status' : v.ORD_PRD_STAT_NM,
                            'item_name' : v.PRD_OPT_NM,
                            'order_name' : v.RCVR_NM,
                            'tel' : tel,
                            'price' :  v.SEL_PRC.replace(/[^0-9]/g,''),
                            'count' : v.ORD_QTY,
                            'item_no' : v.PRD_NO,
                            'addr' : v.RCVR_BASE_ADDR,
                            'will_be_price' : v.SEL_FEE_AMT.replace(/[^0-9]/g,''),
                            'pay_date' : v.ORD_STL_END_DT,
                            'rec_name' : v.RCVR_NM,
                            // 'order_id' : v.ORDER_ORDER_MEMBER_ID
                        })
                    });

                    return new Promise.map(insert_arr, function(insert) {
                        return new Promise(function (resolve, reject) {

                            var query = 'insert into marketOrder SET ?' +
                                ' ON DUPLICATE KEY UPDATE status = \'' + insert.status + '\'';

                            connection.query(query, insert, function (error, results, fields) {
                                if (error) throw(error);
                            });

                            resolve(true);
                        })
                    }).then(function(){
                        xvfb.stopSync();
                        res.send('SUCCESS');
                    })
                })
        })

});


/* 발송처리 */
router.get('/11stDlv', function(req, res, next) {
    var nightmare = Nightmare({ show: true });
    var storedCookies;
    var cookiejar; // 쿠키 정보 저장;
    xvfb.startSync();

    return new Promise(function(resolve,reject){
        return nightmare
            .goto('https://login.soffice.11st.co.kr/login/Login.page?returnURL=http%3A%2F%2Fsoffice.11st.co.kr%2FIndex.tmall')
            .wait('#loginName')
            .type('#loginName', "ID를 입력주세요")
            .type('#passWord', "PW를 입력해주세요")
            .click('.btn_login')
            .wait(2000)
            .cookies.get()
            .end()
            .then((cookies) => {
                storedCookies = cookies;

                resolve(storedCookies);
            })
            .catch((error) => {
                console.error(error);
            });
    })
        .then(function (re){

            var cookie = "";
            cookiejar = rp.jar();

            for(var i = 0; i < re.length; i++){
                cookie = request.cookie(re[i].name+"="+re[i].value);
                cookiejar.setCookie(cookie,'https://soffice.11st.co.kr/');
            }

            return new Promise(function (resolve, reject) {

                var query = 'select item_no, dlv_no, order_no, count from marketOrder where market_name = "11번가" AND status ="신규주문"';

                connection.query(query, function (error, results, fields) {
                    // console.log(results);
                    return resolve(results);
                });


            }).then(function (results){
                var string = JSON.stringify(results);
                var json =  JSON.parse(string);

                if(json.length == 0){
                    res.send("success - nodata");
                    return false;
                }

                return new Promise.map(json, function(v) {
                    return new Promise(function (resolve, reject) {
                        var form = {
                            'data': '[{"DLV_NO":"'+v.dlv_no+'","DLV_MTHD_CD":"%EB%B0%B0%EC%86%A1%ED%95%84%EC%9A%94%EC%97%86%EC%9D%8C","DLV_ETPRS_NM":"","ORD_NO":"'+v.order_no+'","ORD_PRD_SEQ":"1","INVC_NO":"","ORD_QTY":"1","PRD_NO":"'+v.item_no+'","ADD_PRD_NO":"0","GBL_ITG_MEM_NO":"0","BSN_DEAL_CLF":"01"}]',
                            'chkPrdNoList': '',
                        };

                        var options = {
                            uri: "https://soffice.11st.co.kr/escrow/shipping/getInvoiceList.tmall?method=insertSendFinishLogistics",
                            method : "POST",
                            jar: cookiejar, // Tells rp to include cookies in jar that match uri
                            form: form
                        };

                        return rp(options)
                            .then(function (re){
                                var data = JSON.parse(re);

                                if(data.success){
                                    res.send('success');
                                }else{
                                    res.send('fail');
                                }
                            })

                    })
                }).then(function(){
                    xvfb.stopSync();
                })
            })

        })

});
module.exports = router;
