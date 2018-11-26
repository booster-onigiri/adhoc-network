var bleno = require('bleno');
var data = Buffer("");
var fs = require('fs');
var util = require('util');


class term
{
	constructor(uuid){
		this.uuid = uuid;
		this.id = 1;
		this.uuDB = [];
		this.idDB = [];
	}

	set id(id){
		this.id = id;
	}
	set uuDB(uuDB){
		this.uuDB = uuDB;
	}
	set idDB(idDB){
		this.idDB = idDB;
	}
	get uuid(){
		return this.uuid;
	}
	get id(){
		return this.id;
	}
	get uuDB(){
		return this.uuDB;
	}
	get idDB(){
		return this.idDB;
	}
}

//文字列bufをAdvertising
var send = function(buf){
	bleno.startAdvertisingWithEIRData(buf, function (err) { });
};
//文字列bufをテキスト出力(path)
var write = function(path, buf){
	fs.appendFileSync(path, buf, function (err) {
		console.log(err);
	 });
};

var join = function(uuid){
	//uuidの送信
	send(uuid);
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

bleno.on('stateChange', function (state) {
    console.log('bleno.on -> stateChange: ' + state);
    if (state === 'poweredOn') {

	/*~~~~~ ここから処理開始 ~~~~~*/
	//初期化
	var myterm = term("myUUID");
	myterm.idDB.push(this.id);
	myterm.uuDB.push(this.uuid);

	var buf;
	buf = Buffer(util.format('END'));
	console.log(buf);

	send(buf);
	write('Output.txt', "abcde"+"\n");
	


	process.exit();
    } else {
        bleno.stopAdvertising();
    }

	//処理終了

});

