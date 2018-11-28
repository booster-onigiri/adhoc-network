var bleno = require('bleno');

module.exports = send;

//文字列bufをAdvertising
function send(buf){
	bleno.startAdvertisingWithEIRData(buf, function (err) { });
};