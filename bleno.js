var bleno = require('bleno');

module.exports = send;
module.exports = bleno;

bleno.on('stateChange', function (state) {
    console.log('bleno.on -> stateChange: ' + state);
    if (state === 'poweredOn') {
	
	/*~~~~~ ここから処理開始 ~~~~~*/
	//初期化
	// var myterm = new term("myUUID");
	// myterm.idDB.push(this.id);
	// myterm.uuDB.push(this.uuid);

	// var buf;
	// buf = Buffer(util.format('END'));
	// console.log(buf);

	// send(buf);
	// write('Output.txt', "abcde"+"\n");
	
	//処理終了
	}
});



//æ–‡å­—åˆ—bufã‚’Advertising
function send(buf){
	bleno.startAdvertisingWithEIRData(buf, function (err) { });
};