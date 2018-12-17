//モジュールの読み込み
var noble = require('noble')
var bleno = require('bleno')
var fs = require('fs')
var macAddr = require('node-getmac')



//自分のMACアドレスとID
var myMAC = macAddr.replace(/:/g,'')
var myid = 1


// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~初期化処理の定義~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//

var initialProcess = () => {

/////////////		bleno 定義部分			//////////////

bleno.on('stateChange',  (state) => {
    console.log('bleno.on -> stateChange: ' + state)
    if (state === 'poweredOn') {
	
	/*~~~~~ ここから処理開始 ~~~~~*/
	//初期化

	
	//処理終了
	}
});

/////////////////////////////////////////////////////////






/////////////		noble 定義部分			//////////////

noble.on('stateChange',  (state) => {
    console.log('noble.on -> stateChange: ' + state)
    if (state === 'poweredOn') {
        noble.startScanning([], true)
    } else {
        noble.stopScanning()
    }
});

noble.on('discover',  (peripheral) => {
	var data
	data = peripheral.advertisement.eir
    data.toString('ascii', 0, 3)
});

/////////////////////////////////////////////////////////

}

// ~~~~~~~~~~~~~~~~~~~~~~~~~初期化処理の定義 おわり~~~~~~~~~~~~~~~~~~~~~~~~~~~//






//////////////////////マクロ関数定義///////////////////////

//パケット送信用関数
function send(buf){
	bleno.startAdvertisingWithEIRData(buf,  (err) => { })
}
//ファイル書き込み
function write(path, buf){
	fs.appendFileSync(path, buf,  (err) => {
		console.log(err)
	 })
}

/////////////////////////////////////////////////////////




// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~メイン処理の定義~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//

var mainProcess = () => {

//ID管理用データベース
//連想配列により実装
var id_DataBase = []

//ID管理用データベースへの挿入＋ソート
var idPush = (macAdress, ID) => {
	id_DataBase.push({MAC:macAdress, ID:ID})
	id_DataBase.sort((a,b) => {
		if(a.ID<b.ID) return -1
		if(a.ID>b.ID) return 1
		return 0
	});
};

idPush(myMAC,myid)
idPush("1234",3)
idPush("3456",2)

console.log(id_DataBase)

var makePaket = (MAC, PaketType, DestID, PaketNum, DeleteReq, HopRemain) => {
	buf = Buffer("00000" + MAC + "000000" + PaketType + DestID + PaketNum + DeleteReq + HopRemain)
	return buf
};
//パケットの構成
/*
1~5			<0埋め>
6~17		MACアドレス
18~23		<0埋め>
24			データの種類	(0:ハッシュID配布、1:NWリクエスト、2:NWリプライ、3:Message、4:ACK)
25~26		宛先ハッシュID(メッセージ用)／提案ハッシュID(NW構築用)
27			データID［送信パケット数］（メッセージ用）
28~30		データ消去要求
							28~29		端末ハッシュID（消去する通常メッセージの送信元）
							30			データID（消去する通常メッセージのデータID）
31			ホップ回数(ネットワーク構築時は0)

	{	00000[MACアドレス]000000[データ種類][宛先／提案ハッシュID][データID][データ消去要求][ホップ回数]	}
*/


var join = (uuid) => {
	var PaketType = 1				//データの種類
	var SuggestID					//提案ハッシュID
	var PaketNum = 1				//データID（パケット数）
	var DeleteReq = "000"			//データ消去要求
	var HopRemain = "0"				//ホップ回数
	//NW構築のため、データ消去要求は０埋め。ホップなし

	
	/* MACアドレスの送信 */
	SuggestID = "00"				//提案IDそもそもいる？
	send(makePaket(myMAC, PaketType, SuggestID,PaketNum,DeleteReq, HopRemain))
	
	//リクエスト受信    -> IDDBを受け取る
	

	//serverになる
};



var server = ()=>{
	/* 処理準備 */
	var newID
	
	//仮定：リクエストを受ける
	//MAC:"testMAC"
	receive_MAC = "testMAC"
	var data = Buffer("00000" + myMAC + "000000" + "1" + "00" + "1" + "000" + "0")
	
	
	
	
	//パケットを分解
	var mac = data.toString('ascii', 5, 17)
	var PaketType = data.toString('ascii', 23, 24)
	var SuggestID = data.toString('ascii', 24, 26)
	var PaketNum = data.toString('ascii', 26, 27)

	

	

	//同じmacが既に存在するかチェック
	id_DataBase.forEach((a) => {
		if(a.MAC == receive_MAC) {
			newID = a.ID
			console.log("Existing ID is:" + newID)
		}
	})

	//同じMACが存在しないときは、使えるIDを返す
	if(newID == null){
		/* newIDをカウント変数として使う */
		newID = 1


		/* 使われていないハッシュIDの検索 */
		id_DataBase.forEach((a) => {
			if(a.ID == newID) newID++
		})
		console.log("newID is:"+newID)
		idPush(receive_MAC,newID)
		console.log(id_DataBase)
	}


	//そのidを受信機に送信
	send(makePaket(myMAC, 2, newID,1,"000", "0"))
	//参入者をメンバーに通知

};

server();

}

// ~~~~~~~~~~~~~~~~~~~~~~~~~メイン処理の定義 おわり~~~~~~~~~~~~~~~~~~~~~~~~~~~//
























//	実行部
//　初期化→メイン　となるように順序を制御する

let promise = new Promise((resolve, reject) => { // 初期化処理
	console.log('InitialProcess')
	initialProcess()
	resolve()
  })
promise.then(() => { 							// メイン処理
	return new Promise((resolve, reject) => {
	  setTimeout(() => {
		console.log('MainProcess')
		mainProcess()
		resolve()
	  }, 500)
	})
  }).catch(() => { 								// エラーハンドリング
	console.error('Order Control Error!')
  })


  