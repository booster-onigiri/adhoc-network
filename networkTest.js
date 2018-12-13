var write = require('./write');
var send = require('./bleno');
var noble = require('./noble');
var adress = require('node-getmac');
var data = Buffer("");
var util = require('util');
var macAddr = require('node-getmac');

var myMAC = macAddr.replace(/:/g,'');
var myid = 1;
//ID管理用データベース
//連想配列により実装
var id_DataBase = [];

//ID管理用データベースへの挿入＋ソート
var idPush = function(macAdress, ID){
	id_DataBase.push({MAC:macAdress, ID:ID});
	id_DataBase.sort(function(a,b){
		if(a.ID<b.ID) return -1;
		if(a.ID>b.ID) return 1;
		return 0;
	});
};

idPush(myMAC,myid);
idPush("1234",3);
idPush("3456",2);

console.log(id_DataBase);

var makePaket = function(MAC, PaketType, DestID, PaketNum, DeleteReq, HopRemain){
	buf = Buffer("00000" + MAC + "000000" + PaketType + DestID + PaketNum + DeleteReq + HopRemain);
	return buf;
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


var join = function(uuid){
	var PaketType = 1;				//データの種類
	var SuggestID;					//提案ハッシュID
	var PaketNum = 1;				//データID（パケット数）
	var DeleteReq = "000";			//データ消去要求
	var HopRemain = "0";			//ホップ回数
	//NW構築のため、データ消去要求は０埋め。ホップなし

	
	/* MACアドレスの送信 */
	SuggestID = "00";				//提案IDそもそもいる？
	send(makePaket(myMAC, PaketType, SuggestID,PaketNum,DeleteReq, HopRemain));
	
	//リクエスト受信    -> IDDBを受け取る
	

	//serverになる
};



var server = function(){
	//受け取ったと仮定
	var newID = 1;
	var data = Buffer("00000" + myMAC + "000000" + "1" + "00" + "1" + "000" + "0");
	//MACアドレスを受け取る
	var mac = data.toString('ascii', 5, 17);
	var PaketType = data.toString('ascii', 23, 24);
	var SuggestID = data.toString('ascii', 24, 26);
	var PaketNum = data.toString('ascii', 26, 27);

	receive_MAC = "hoge";

	//同じmacが既に存在するかチェック
	if(id_DataBase[receive_MAC] == null) {	/*true:未登録MACアドレス*/

		//使われていないハッシュIDの検索
		id_DataBase.forEach(function(a){
			if(a.ID == newID) newID++;
		});
		console.log("newID is:"+newID);
		idPush(receive_MAC,newID);
		console.log(id_DataBase);
	}

	//そのidを受信機に送信
	
	//参入者をメンバーに通知

};

server();