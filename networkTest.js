//モジュールの読み:込み
var noble = require('noble')
var bleno = require('bleno')
var fs = require('fs')
var macAddr = require('node-getmac')



//自分のMACアドレスとID
var myMAC = macAddr.replace(/:/g,'')
var myid = 1


//各フラグ
var client_reply = false	//新規参入者がサーバーに接続中かどうか
var client_switch = true	//新規参入者かどうか
var newer_handling = false	//参入者の募集をしているか、誰かの参入に対応中か


//////////////////////関数定義///////////////////////

//パケット送信関数
function AdvertisingData(buf){
	bleno.startAdvertisingWithEIRData(buf,  (err) => { })
}

//ファイル書き込み関数
function TextOutput(path, buf){
	fs.appendFileSync(path, buf,  (err) => {
		console.log(err)
	 })
}

//	ネットワーク構築パケットの構成
/************************************************************************************************************************

1~2			"ad"	ネットワーク構築用パケットを指す
3~14		MACアドレス
15			データの種類	(0:ハッシュID配布、1:NWリクエスト、2:NWリプライ、3:Message、4:ACK)
16~17		宛先／提案ハッシュID
18			パケットID
19~20		送信元ハッシュID
21			ID管理用データベースのサイズ
22			TTL
23~24		同期用ハッシュID

25~31		フリースペース

{ [MACアドレス][データ種類][宛先／提案ハッシュID][パケットID][送信元ハッシュID][ID管理用データベースサイズ][TTL]0000000	}

*************************************************************************************************************************/

//ネットワーク構築用パケット作成関数
//引数からパケット用Bufferをつくる
var makeNetworkConstructionPacket = (mac, packet_type, proposal_destination_id , paket_id, sender_id, management_db_size, hop_remain, sync_data = "00") => {
	//２桁文字列にする　1→01
	var shaped_proposal_destination_id = ( '00' +  Number(proposal_destination_id)).slice( -2 )		
	var shaped_sender_id = ( '00' +  Number(sender_id)).slice( -2 )
	var shaped_sync_data = ( '00' +  Number(sync_data)).slice( -2 )
	//文字列→Buffer
	var buf = Buffer("Ad"+ mac + packet_type + shaped_proposal_destination_id + paket_id + shaped_sender_id + management_db_size + hop_remain + shaped_sync_data + "0000000")
	return buf
}
var makeMessagePacket = (destination_id, sender_id, data_id, sequence_no, division_number, hop_remain, message) => {
	//２桁文字列にする　1→01
	var shaped_destination_id = ( '00' +  Number(destination_id)).slice( -2 )
	var shaped_sender_id = ( '00' +  Number(sender_id)).slice( -2 )
	var shaped_data_id = ( '00' +  Number(data_id)).slice( -2 )
	var shaped_sequence_no = ( '00' +  Number(sequence_no)).slice( -2 )
	var shaped_division_number = ( '00' +  Number(division_number)).slice( -2 )
	
	//文字列→Buffer
	var buf = new Buffer("Me" + shaped_destination_id + shaped_sender_id + shaped_data_id + shaped_sequence_no + shaped_division_number + hop_remain + message, 'utf8')
	return buf
}

//ネットワーク構築パケットのゲッター関数
//MACアドレス
function getAdMac(data){
	return data.toString('ascii', 2, 14)
}
//パケットタイプ
function getAdPacketType(data){
	return data.toString('ascii', 14, 15)
}
//提案・宛先ハッシュID
function getAdProposalDestinationId(data){
	return Number(data.toString('ascii', 15, 17))
}
//パケットID
function getAdPacketID(data){
	return Number(data.toString('ascii', 17, 18))
}
//送信元ハッシュID
function getAdSenderID(data){
	var sender_id =data.toString('ascii', 18, 20)
	return Number(sender_id)
}
//ID管理用データベースのサイズ
function getAdManagementDBSize(data){
	return data.toString('ascii', 20, 21)
}
//TTL
function getAdHopRemain(data){
	var hop_char = data.toString('ascii', 21, 22)
	return Number(hop_char)
}
//同期用ハッシュID
function getAdSyncData(data){
	return Number(data.toString('ascii', 22, 24))
}

//メッセージパケットのゲッター関数
//宛先ハッシュID
function getMeDestinationID(data){
	return Number(data.toString('utf8', 2, 4))
}
//送信元ハッシュID
function getMeSenderID(data){
	return Number(data.toString('utf8', 4, 6))
}
//データID
function getMeDataID(data){
	return Number(data.toString('utf8', 6, 8))
}
//シーケンスNo
function getMeSequenceNo(data){
	return Number(data.toString('utf8', 8, 10))
}
//分割数
function getMeDivisionNumber(data){
	return Number(data.toString('utf8', 10, 12))
}

//TTL
function getMeHopRemain(data){
	return Number(data.toString('utf8', 12, 13))
}
//メッセージ
function getMeMassage(data){
	return data.toString('utf8', 13)
}
/////////////////////////////////////////////////////////



//ID管理用データベース
//連想配列により実装
var id_ManagementDatabase = []

//再送防止用データベース
var ResendPreventionDatabase = []

//ID管理用データベースへの挿入＋ソート
var idPush = (macAdress, ID) => {
	//挿入
	id_ManagementDatabase.push({MAC:macAdress, ID:ID, LINK:false, PING:false})
	//ソート
	id_ManagementDatabase.sort((a,b) => {
		if(a.ID<b.ID) return -1
		if(a.ID>b.ID) return 1
		return 0
	})
}

//再送防止用データベースへの挿入＋ソート
var resendPush = (sender_id, data_id, sequence_no) => {
	//挿入
	ResendPreventionDatabase.push({SenderID:sender_id, DataID:data_id, SequenceNo:sequence_no})
	//送信元IDでソート
	ResendPreventionDatabase.sort((a,b) => {
		if(a.SenderID<b.SenderID) return -1
		if(a.SenderID>b.SenderID) return 1
		if(a.DataID<b.DataID) return -1
		if(a.DataID>b.DataID) return 1
		if(a.SequenceNo<b.SequenceNo) return -1
		if(a.SequenceNo>b.SequenceNo) return 1
		return 0
	})
}
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~メイン処理の定義~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//

var MainProcess = () =>{
	
idPush(myMAC,myid)
//idPush("111111111111",3)
//idPush("222222222222",2)

console.log("データベースの初期化")
console.log(id_ManagementDatabase)

}

var join = () => {
	/* MACアドレスの送信 */
	console.log("自分の送信：" + makeNetworkConstructionPacket(myMAC, 1, "00", 1, "00", "0", 0,"00"))
	AdvertisingData(makeNetworkConstructionPacket(myMAC, 1, "00", 1, "00", "0", 0,"00"))
	
	/* 時間経過で既存ネットワークを発見できない→ネットワーク新規作成 */
	setTimeout(() => {
		if(client_switch) {
			console.log("周囲にサーバーなし。サーバー起動")
			bleno.stopAdvertising()
			client_switch = false
		}
	},10000)

}



// ~~~~~~~~~~~~~~~~~~~~~~~~~メイン処理の定義 おわり~~~~~~~~~~~~~~~~~~~~~~~~~~~//






// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~初期化処理の定義~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//


var Type1Process = (data) => {
	//参入者はこの処理に入らないようにする
	if(client_switch) return
					
	/*bleno.stopAdvertising()*/
	if(client_switch) return				//サーバーモードかどうか
	else if(newer_handling) return			//参入者の対応中かどうか
	else {
		newer_handling = true	
		var proposal_ID
		
		//パケットを分解
		var receive_mac = getAdMac(data)
		

		//同じmacが既に存在するかチェック
		id_ManagementDatabase.forEach((a) => {
			if(a.MAC == receive_mac) {
				proposal_ID = a.ID
				console.log("Existing ID is:" + proposal_ID)
			}
		})

		//同じMACが存在しないときは、使えるIDを返す
		if(proposal_ID == null){
			proposal_ID = 1
			/* 使われていないハッシュIDの検索 */
			id_ManagementDatabase.forEach((a) => {
				if(a.ID == proposal_ID) proposal_ID++
			})
			console.log("proposal_ID is:"+proposal_ID)
		}

		//そのidを受信機に送信
		console.log("自分の送信：" + makeNetworkConstructionPacket(getAdMac(data), 2, proposal_ID,1, myid, "0", 0, "00"))
		AdvertisingData(makeNetworkConstructionPacket(getAdMac(data), 2, proposal_ID,1, myid, "0", 0, "00"))
		}
}

var Type2Process = (data) => {
	//サーバーはこの処理に入らないようにする
	if(client_switch == false) return

	// 他のサーバーに対応されている場合は、他のサーバーからの提案を無視
	if(client_reply) return
	
	// 自分宛ての提案かどうか
	if(getAdMac(data) == myMAC){
		client_reply = true
		/*bleno.stopAdvertising()*/
		myid = getAdProposalDestinationId(data)
		console.log("私のIDは・・・")
		console.log(myid)
		//データベースを初期化
		id_ManagementDatabase = []

		//提案IDの受諾メッセージ
		console.log("提案に対する受諾" + makeNetworkConstructionPacket(myMAC, 3, getAdSenderID(data), 1, myid, "0", "0"))
		AdvertisingData(makeNetworkConstructionPacket(myMAC, 3, getAdSenderID(data), 1, myid, "0", "0","00"))
	}
}

var Type3Process = (data) => {
	console.log("ケース３：提案に対する受諾メッセージ")
	console.log("宛先は・・・")
	console.log(getAdProposalDestinationId(data))

	//自分に対するメッセージでなければ破棄	
	if(getAdProposalDestinationId(data) == myid) {
		console.log("ケース３：通過しました。続行します")
		/*bleno.stopAdvertising()*/

		// ID管理用DBにこの端末が登録されているか確認
		var found_flag = false
		id_ManagementDatabase.forEach((a) => {
			if(a.MAC == getAdMac(data)) {
				found_flag = true
			}
		})
		// ID管理用DBに登録されていないときは新規登録
		if(found_flag == false) {
			idPush(getAdMac(data),getAdSenderID(data))
			console.log("DATA BASE UPDATED!!")
			console.log(id_ManagementDatabase)
		}							
		/* 周囲に新規端末の通知 */
		console.log("周囲に新規端末をお知らせします")
		AdvertisingData(makeNetworkConstructionPacket(getAdMac(data),4,getAdSenderID(data),1,myid,"0",5,"00"))

		//新規端末へID管理用データベースの送信
		console.log("新規端末へIDDBを転送します")
		setTimeout(() => { 
			id_ManagementDatabase.forEach((a) => {
				if(a.ID == 1) {
					AdvertisingData(makeNetworkConstructionPacket(a.MAC,5,getAdSenderID(data),1,myid,id_ManagementDatabase.length,5,a.ID))
					console.log(makeNetworkConstructionPacket(a.MAC,5,getAdSenderID(data),1,myid,id_ManagementDatabase.length,5,a.ID).toString())
				}
		 })},200)
				
	}else{
		//参加者には他の端末が担当するため、参加対応を終了する
		newer_handling = false
	}
	
} 

var Type4Process = (data) => {
	// 新規端末はこの処理を行わない
	if(getAdProposalDestinationId(data) == myid) return
	console.log("新規端末ではない")
	// 担当者はこの処理を行わない
	if(getAdSenderID(data) == myid) return
	console.log("担当者ではない")
	// サーバー以外はこの処理を行わない
	if(client_switch) return
	console.log("全項目クリア。新規端末登録")


	var hop_remain = getAdHopRemain(data)
	// ID管理用DBにこの端末が登録されているか確認
	var found_flag = false
	id_ManagementDatabase.forEach((a) => {
		if(a.MAC == getAdMac(data)) {
			found_flag = true
		}
	})
	if(found_flag == false) {
		idPush(getAdMac(data),getAdProposalDestinationId(data))
		console.log("新規端末を登録しました")
		console.log(id_ManagementDatabase)
	}
	/* 周囲に新規端末の通知 */
	hop_remain --
	AdvertisingData(makeNetworkConstructionPacket(getAdMac(data),4,getAdProposalDestinationId(data),1,getAdSenderID(data),"0",hop_remain,"00"))
	setTimeout(() => { /*bleno.stopAdvertising()*/ }, 500)
}

var Type5Process = (data) => {
	// ID管理用DBにこの端末が登録されているか確認
	if(getAdProposalDestinationId(data) == myid) {
		/*bleno.stopAdvertising()*/
		var found_flag = false
		id_ManagementDatabase.forEach((a) => {
			if(a.MAC == getAdMac(data)) {
				found_flag = true
			}
		})
		// ID管理用DBに登録されていないときは新規登録
		if(found_flag == false) {
			idPush(getAdMac(data),getAdSyncData(data))
			console.log("DATA BASE UPDATED!!")
			console.log(id_ManagementDatabase)
		}
		// サーバーに受信確認を送信
		AdvertisingData(makeNetworkConstructionPacket(getAdMac(data),6,getAdSenderID(data),getAdPacketID(data),myid,"0",5,"00"))
		
		// もしIDがラストだったら、参加終了し、サーバーモードになる
		if(id_ManagementDatabase.length == Number(getAdManagementDBSize(data))){
			console.log("IDデータベースの取得完了")
			console.log(id_ManagementDatabase)
			client_switch = false
			setTimeout(() => { /*bleno.stopAdvertising()*/ }, 500)
		}
	}
}

var Type6Process = (data) => {
	if(getAdProposalDestinationId(data) == myid) {
		/*bleno.stopAdvertising()*/
		var i = getAdPacketID(data)	//受信完了したID
		i++							//次のIDを送信
		 
		if(i>id_ManagementDatabase.length) {	//ID管理用DBの同期終了
			console.log("IDデータベースの送信完了")
			newer_handling = false	//参入者に対応可能に戻す
			return
		}
		id_ManagementDatabase.forEach((a) => {
			if(a.ID == i) AdvertisingData(makeNetworkConstructionPacket(a.MAC,5,getAdSenderID(data),i,myid,id_ManagementDatabase.length,5,a.ID))
		})
	}
}


// =========================リンク維持========================== //

// １０秒間に受信したPINGを記憶しておく
var Type0Process = (data) => {
	var flag = false
	//受信したパケットからリンク保証を記録
	id_ManagementDatabase.forEach((a) => {
		if(a.MAC == getAdMac(data)){
			if(a.PING == true) 	flag = true//すでに受信済みパケットなら破棄
			a.PING = true
		}
	})
	
	if(flag) return
	console.log("PINGマルチホップ")
	AdvertisingData(data)
}

// PINGを５秒ごとに送信する
var DoPing = () => {
	var pingTimer = null

	var ping = function(){
		if(client_switch == false){
			AdvertisingData(makeNetworkConstructionPacket(myMAC, 0, myid, 1,"00", "0",5,"00"))
			//setTimeout(() => { /*bleno.stopAdvertising()*/ }, 200)
			console.log("PINGを出しています")
		}
	}

	pingTimer = setInterval(ping, 5000)
	//５秒ごとにPINGを出します
}

// １０秒毎にリンクを再構築する
var LinkRebuild = () => {
	var linkBuildTimer = null

	var makelink = function(){
		console.log("リンクを構築します")
		id_ManagementDatabase.forEach((a) => {
			a.LINK = a.PING
			a.PING = false
		})
		console.log(id_ManagementDatabase)
	}
	linkBuildTimer = setInterval(makelink, 10000)
}

// メッセージを送信する関数
////	destination_id	宛先
////	message			送信するメッセージ
var SendMessage = (destination_id=2 , message = "おはよう") => {
	//ネットワーク内にいるか確認
	if(myid == 1){
	if(client_switch == false){
		//宛先のリンク確認
		/* 未実装 */


		//使用可能なデータIDの問い合わせ
		var available_data_id = 1
		ResendPreventionDatabase.forEach((a) => {
			if(a.SenderID == myid) {
				//再送防止用DBに、自分が送ったパケットがあった場合
				
				//空いているデータIDを探索する
				if(a.DataID == available_data_id) available_data_id++
			
			}
			else{
				//再送防止用DBに、自分が送ったパケットがなかった場合
				//使用可能IDは1である。変更する必要なし
			} 
		})

		//再送防止用DBに登録
		resendPush(myid, available_data_id, 1)

		console.log("再送防止用データベースの更新")
		console.log(ResendPreventionDatabase)
		
		var buf = makeMessagePacket(destination_id, myid, available_data_id, 1, 1, 5, message)	
		AdvertisingData(buf)
		console.log("メッセージ送信")
		console.log("「",getMeMassage(buf), "」")
		
	}
	}
}


var MassageReceiveProcess = (data) =>{
	//パケット解析
	var destination_id = getMeDestinationID(data)
	var sender_id = getMeSenderID(data)
	var data_id = getMeDataID(data)
	var sequence_no = getMeSequenceNo(data)
	var hop_remain = getMeHopRemain(data)
	var message = getMeMassage(data)

	//再送防止用DBに登録されているか調べる
	var found_flag = false
	ResendPreventionDatabase.forEach((a) => {
		if(a.SenderID == sender_id)
			if(a.DataID == data_id)
				if(a.SequenceNo == sequence_no){
					//既に登録されているためフラグを立てる
					console.log("既に再送防止DBに登録されています")
					found_flag = true
				}
	})
	
	//登録済みならフラグで関数を抜ける
	if(found_flag) return
	
	//再送防止用データベースに登録する
	console.log("受信側：再送防止DBに登録します")
	resendPush(sender_id, data_id, sequence_no)

	//宛先を調べてそれぞれの処理を行う
	if(destination_id == myid){
		console.log("自分宛てのメッセージを受信「", message, "」")
	}else if(destination_id == 0){
		//ブロードキャストの場合はパケットの中継も行う
		console.log("ブロードキャスト「", message, "」")
		AdvertisingData(data)
	}else{
		//他者へのメッセージは中継する
		console.log("他者へのメッセージ")
		AdvertisingData(data)
	}
}

// ============================================================= //

var InitialProcess = () => {

	/////////////		bleno 定義部分			//////////////
	
	bleno.on('stateChange',  (state) => {
		console.log('bleno.on -> stateChange: ' + state)
		if (state === 'poweredOn') {}
	})
	
	/////////////////////////////////////////////////////////
	
	
		
	
	/////////////		noble 定義部分			//////////////
	
	noble.on('stateChange',  (state) => {
		console.log('noble.on -> stateChange: ' + state)
		if (state === 'poweredOn') {
			noble.startScanning([], true)
		} else {
			noble.stopScanning()
		}
	})
	
	noble.on('discover',  (peripheral) => {
		var data
		data = peripheral.advertisement.eir
		if(data.toString('ascii', 0, 2)=='Ad'){			
			switch(getAdPacketType(data))
			{
			case '0':	//ID配布
				if(client_switch == false)
					if(newer_handling == false)
						Type0Process(data)
				break
					
			case '1':	//新規端末のブロードキャストを受信
				Type1Process(data)
				break
					
			case '2':	//使用可能IDの提案メッセージを受信
				Type2Process(data)
				break
			
			case '3':	//提案に対する受諾メッセージを受信
				Type3Process(data)
				break

			case '4':	// 新規端末登録　担当からの通知から
				Type4Process(data)
				break
			
			case '5':	//ID管理用DB同期　参入者→サーバー
				Type5Process(data)
				break
			case '6':	// ID管理用DB同期　サーバー→参入者
				Type6Process(data)
				break
			default:
				break
			}

		}else if(data.toString('utf8', 0, 2)=='Me'){
			//メッセージパケット受信時の処理
			console.log("メッセージパケットを受信しました")
			MassageReceiveProcess(data)
		}
	})
	
	/////////////////////////////////////////////////////////
	
}
	

// ~~~~~~~~~~~~~~~~~~~~~~~~~初期化処理の定義 おわり~~~~~~~~~~~~~~~~~~~~~~~~~~~//


InitialProcess()
MainProcess()
setTimeout(join, 1000)
DoPing()
LinkRebuild()
//setIntervalの重複で動作が中断されている
//sendMessageはなしで実装する必要あり
var messageTestTimer = null
messageTestTimer = setInterval(SendMessage, 12000)
