var noble = require("noble");

module.exports = noble;

//電源ONになったらスキャンを開始する
noble.on('stateChange', function (state) {
    console.log('noble.on -> stateChange: ' + state);
    if (state === 'poweredOn') {
        noble.startScanning([], true);
    } else {
        noble.stopScanning();
    }
});

//パケットが見つかった場合の動作を定義
noble.on('discover', function (peripheral) {
    data = peripheral.advertisement.eir;
    data.toString('ascii', 0, 3)
});

