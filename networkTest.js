var write = require('./write');
var send = require('./send');
var bleno = require("bleno");
var noble = require('./noble');
var data = Buffer("");

var util = require('util');



var term = class
{
	constructor(uuid){
		this.uuid = uuid;
		this.id = 1;
		this.uuDB = [];
		this.idDB = [];
	}

}


//文字列bufをテキスト出力(path)
// var write = function(path, buf){
// 	fs.appendFileSync(path, buf, function (err) {
// 		console.log(err);
// 	 });
// };

var join = function(uuid){
	//uuidの送信
	send(uuid);
	//リクエスト受信    -> IDDBを受け取る
	[]
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
	var myterm = new term("myUUID");
	myterm.idDB.push(this.id);
	myterm.uuDB.push(this.uuid);

	var buf;
	buf = Buffer(util.format('END'));
	console.log(buf);

	send(buf);
	write('Output.txt', "abcde"+"\n");
	
	//処理終了
	}
});

