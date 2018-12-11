var write = require('./write');
var send = require('./bleno');
var noble = require('./noble');
var adress = require('node-getmac');
var data = Buffer("");
var util = require('util');
var macAddr = require('node-getmac');

var myMAC = macAddr.replace(/:/g,'');

//ID管理用データベース
//連想配列により実装
var id_DataBase = {mac:myMAC, id:1};
console.log(id_DataBase);



var join = function(uuid){
	
	//uuidの送信
	send(myMAC);
	//リクエスト受信    -> IDDBを受け取る
	
	//serverになる
};

var server = function(){
	//uuidを受け取る
	
	//同じuuidが既に存在するかチェック

	//利用可能idをチェック

	//そのidを受信機に送信

	//参入者をメンバーに通知

};

