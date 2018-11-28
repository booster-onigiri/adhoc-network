var noble = require("noble");

module.exports = noble;

noble.on('stateChange', function (state) {
        console.log('noble:statecheck:' + state);
        switch (state) {
            case 'poweredOn':
                noble.startScanning([], true);
                console.log("noble:poweredOn");
                scanningstart();
                break;
            default:
                console.log("noble:stopScanning");
                noble.stopScanning();
                break;
        }
    });

scanningstart = function () {
    return noble.on('discover', function (peripheral) {
        var data, i;
        var total = 0;
        data = peripheral.advertisement.eir;
        try {
            // 終了処理
            if (data.toString('ascii', 0, 3) == "END") {
                for(i = 0; i < 10000; i++) {
                    if(receive_paket_array[i] == true) total++;
                }
                fs.appendFileSync('log_receive.txt', total + '\n', function (err) { });
                fs.appendFileSync('log_receive.txt', "loss is " + total/10000 + '\n', function (err) { });
                process.exit(0);
            }
            
            //実際の処理を定義 
            if (data.toString('ascii', 2, 4) == "No") {
                console.log(data);
                // ��M�f�[�^��������
                fs.appendFileSync('log_receive.txt', data + rssi + '\n', function (err) { });
                /* 
                [paket No]    Number(data.toString('ascii', 4, 9))
                */
                receive_paket_array[Number(data.toString('ascii', 4, 9))] = true;
                switch (data.toString('ascii', 0, 1)) {
                    case receiveNo:
                        data[0] = 0x32;
                        fs.appendFileSync('log_relay.txt', data + '\n', function (err) { });
                        bleno.startAdvertisingWithEIRData(data);
                        break;
                    default:
                        fs.appendFileSync('log_relay.txt', 'Flading switch error!\n', function (err) { });
                        break;
                }
            } 
        } catch (error1) {

        }
    });
};
