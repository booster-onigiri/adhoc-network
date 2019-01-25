//モジュールの読み込み
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


/** 実験用 **/
//実験用シーケンス番号
var test_num = 1
/************/


//////////////////////関数定義///////////////////////
var advertisementData = []


function Advertising(){
	bleno.startAdvertisingWithEIRData(advertisementData.shift(),  (err) => { })
}

//パケット送信関数
function AdvertisingData(buf){
	bleno.startAdvertisingWithEIRData(buf,  (err) => { })
	//advertisementData.push(buf)
}

//ファイル書き込み関数
function FileOutput(path, buf){
	fs.appendFileSync(path, buf,  (err) => {
		console.log(err)
	 })
}

/////////////////////クラス定義/////////////////////
//あるノードの隣接ノード情報を記憶するクラス
class neighborInfo{
    constructor(id){
	  //ノードのID
	  this.id = id
	  //隣接ノードのIDの配列
      this.neighbor_nodes = []
    }
    push(value){
		//push(ノードのID)で隣接ノードの入力
        this.neighbor_nodes.push(value)
    }

  }

//各ノードの隣接情報から経路表を作成する
var MakeRoutingTable = (terminals, my_node)=>{

    //自分の隣接ノード
    var near_node = my_node.neighbor_nodes.slice()
    //自分が知っているノード
    var known_node = my_node.neighbor_nodes.slice()
    known_node.push(my_node.id)
    known_node.sort()

    //経路表
    var routing_table = []
    var tablePush = (id, weight, to) => {
        routing_table.push({ID:id, Weight:weight, To:to})
    }
    var tableEdit = (id, weight, to) => {
        routing_table.forEach((each_node)=>{
            if(each_node.ID == id){
                each_node.Weight = weight
                each_node.To = to
            }
        })
    }
	var flag_return
    //全ノードの登録cs
    terminals.forEach((node) => {
		tablePush(node.id, 9999, null)
		if(node.neighbor_nodes.length == 0) flag_return = true
    })
	if(flag_return)return
    //自ノードの登録
    tableEdit(my_node.id, 0, null)

    //隣接ノードの登録
    near_node.forEach((node_id) => {
    tableEdit(node_id, 1, node_id)
    })


	
    //経路表のToがすべて隣接ノードになるまでループ
    var flag_all_near_to = true
    while(flag_all_near_to){
        
        routing_table.forEach((table_each_node)=>{
            //ここで経路表の１行目に入る
            //自ノードの場合は飛ばす
            if(table_each_node.ID == my_node.id) return
            
            //そのノードのToが隣接ノードの場合、その行は終了する
            var flag_end_this_line = false
            near_node.forEach((near_any_node) => {
            if(table_each_node.To == near_any_node) flag_end_this_line = true
            })
            if(flag_end_this_line) return
            

            //Toが未登録の場合は、そのIDの隣接ノードでループをかける
            if(table_each_node.To == null){
                //ノード表から検索
                terminals.forEach((each) => {
                    if(each.id == table_each_node.ID){
                        //ノードの隣接ノードを引っ張ってくる
                        each.neighbor_nodes.forEach((table_each_node_near_id) => {
                            known_node.forEach((known_each_node_id) => {
                                //その行の隣接ノード＝知っているノードであればそれをToに設定
                                if(table_each_node_near_id == known_each_node_id){

                                    //その行の重さが更新されるか判断
                                    routing_table.forEach((a)=>{
                                        if(a.ID == known_each_node_id){
                                            if(table_each_node.Weight > a.Weight+1) {
                                                table_each_node.To = known_each_node_id
                                                
                                                //そのノードの重さを更新
                                                table_each_node.Weight = a.Weight+1
                                                known_node.push(table_each_node.ID)
                                                known_node.sort()

                                            }
                                        }
                                    })
                                    
                                                                    
                                }

                            })
                        })
                    }
                })
            }else{
                routing_table.forEach((each) => {
                    if(each.ID == table_each_node.To) table_each_node.To = each.To
                })
            }
        })
        //終了判定
        flag_all_near_to = false
        routing_table.forEach((each_node)=>{
            if(each_node.ID == my_node.id) return
            var count=0
            near_node.forEach((a)=>{
                if(each_node.To != a) count++
            })
            //そうでない場合はwhile文を抜けられない
            if(count == near_node.length) flag_all_near_to = true
            })
    }

    console.log(routing_table)
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
var makeRoutingPacket = (hop_remain, near_node_num, near_node_buf="") => {
	var shaped_myid = ( '00' +  Number(myid)).slice( -2 )
	var shaped_near_node_num = ( '00' +  Number(near_node_num)).slice( -2 )
	var buf = Buffer("Ro" + shaped_myid + hop_remain + shaped_near_node_num + near_node_buf)
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

//隣接ノード情報パケットのゲッター関数
//送信者ID（誰の隣接ノード情報か）
function getRoSenderId(data){
	return Number(data.toString('ascii', 2, 4))
}
//TTL
function getRoHopRemain(data){
	return Number(data.toString('ascii'), 4, 5)
}
//隣接ノードの数
function getRoNeighborNum(data){
	return Number(data.toString('ascii', 5, 7))
}
//隣接ノードID
function getRoNeighborID(data, start){
	return Number(data.toString('ascii', 7+start*2, 9+start*2))
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
	id_ManagementDatabase.push({MAC:macAdress, ID:ID, PING:false, PING_Update:false, NeighborInfo:null, NeighborInfo_Update:false})
	//ソート
	id_ManagementDatabase.sort((a,b) => {
		if(a.ID<b.ID) return -1
		if(a.ID>b.ID) return 1
		return 0
	})
	console.log(id_ManagementDatabase)
}

var resendDelete = (sender_id, data_id, sequence_no) => {
	var index
	ResendPreventionDatabase.forEach((a, i) => {
		if(a.SenderID == sender_id)
			if(a.DataID == data_id)
				if(a.SequenceNo == sequence_no){
					ResendPreventionDatabase.splice(i, 1)
					return true
				}
	})
	console.log("Deleted","  ",sender_id, data_id, sequence_no)
	console.log(ResendPreventionDatabase)
}
//再送防止用データベースへの挿入＋ソート
var resendPush = (sender_id, data_id, sequence_no) => {
	//挿入
	ResendPreventionDatabase.push({SenderID:sender_id, DataID:data_id, SequenceNo:sequence_no})
	setTimeout(resendDelete, 15000, sender_id, data_id, sequence_no)
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

}

var join = () => {
	/* MACアドレスの送信 */
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
	//if(client_switch) return
					

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
			}
		})

		//同じMACが存在しないときは、使えるIDを返す
		if(proposal_ID == null){
			proposal_ID = 1
			/* 使われていないハッシュIDの検索 */
			id_ManagementDatabase.forEach((a) => {
				if(a.ID == proposal_ID) proposal_ID++
			})
		}

		//そのidを受信機に送信
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

		myid = getAdProposalDestinationId(data)
		//データベースを初期化
		id_ManagementDatabase = []

		//提案IDの受諾メッセージ
		AdvertisingData(makeNetworkConstructionPacket(myMAC, 3, getAdSenderID(data), 1, myid, "0", "0","00"))
	}
}

var Type3Process = (data) => {

	if(client_switch) return				//サーバーモードかどうか
	//自分に対するメッセージでなければ破棄	
	if(getAdProposalDestinationId(data) == myid) {


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
		}							
		/* 周囲に新規端末の通知 */
		AdvertisingData(makeNetworkConstructionPacket(getAdMac(data),4,getAdSenderID(data),1,myid,"0",5,"00"))

		//新規端末へID管理用データベースの送信
		setTimeout(() => { 
			id_ManagementDatabase.forEach((a) => {
				if(a.ID == 1) {
					AdvertisingData(makeNetworkConstructionPacket(a.MAC,5,getAdSenderID(data),1,myid,id_ManagementDatabase.length,5,a.ID))
				}
		 })},200)
				
	}else{
		//参加者には他の端末が担当するため、参加対応を終了する
		newer_handling = false
	}
	
} 

var Type4Process = (data) => {

	if(client_switch) return				//サーバーモードかどうか
	// 参加者はこの処理を行わない
	if(getAdProposalDestinationId(data) == myid) return
	// 担当者はこの処理を行わない
	if(getAdSenderID(data) == myid) return
	// サーバー以外はこの処理を行わない
	if(client_switch) return


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
	}
	/* 周囲に新規端末の通知 */
	hop_remain --
	AdvertisingData(makeNetworkConstructionPacket(getAdMac(data),4,getAdProposalDestinationId(data),1,getAdSenderID(data),"0",hop_remain,"00"))
	setTimeout(() => { /*bleno.stopAdvertising()*/ }, 500)
}

var Type5Process = (data) => {
	if(client_switch) return				//サーバーモードかどうか
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
		}
		// サーバーに受信確認を送信
		AdvertisingData(makeNetworkConstructionPacket(getAdMac(data),6,getAdSenderID(data),getAdPacketID(data),myid,"0",5,"00"))
		
		// もしIDがラストだったら、参加終了し、サーバーモードになる
		if(id_ManagementDatabase.length == Number(getAdManagementDBSize(data))){
			console.log("IDデータベースの取得完了")
			console.log(id_ManagementDatabase)
			client_switch = false
			//setTimeout(() => { /*bleno.stopAdvertising()*/ }, 500)
		}
	}
}

var Type6Process = (data) => {
	if(getAdProposalDestinationId(data) == myid) {

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

// １０秒間に受信したPING_Updateを記憶しておく
var Type0Process = (data) => {
	//受信したパケットからリンク保証を記録
	id_ManagementDatabase.forEach((a) => {
		if(a.MAC == getAdMac(data)){
			a.PING_Update = true
		}
	})
}

// PING_Updateを５秒ごとに送信する
var DoPing = () => {
	var pingTimer = null

	var ping = function(){
		if(client_switch == false){
			AdvertisingData(makeNetworkConstructionPacket(myMAC, 0, myid, 1,"00", "0",5,"00"))
			console.log("PING_Updateを出しています")
		}
	}

	pingTimer = setInterval(ping, 5000)
	//５秒ごとにPING_Updateを出します
}

// １０秒毎に隣接ノード情報を更新し、それをブロードキャストする
var LinkRebuild = () => {
	var linkBuildTimer = null

	var makelink = function(){
		if(client_switch == false){
			//リンクの再構築
			id_ManagementDatabase.forEach((a) => {
				a.PING = a.PING_Update
				a.PING_Update = false
			})
			console.log(id_ManagementDatabase)

			//自身の隣接ノード情報をブロードキャスト
			var buf = ""								//パケット作成用の文字列
			var count = 0								//隣接ノードのカウント変数
			var my_neighbor = new neighborInfo(myid)	//自分の隣接ノード情報の入れ物
		
			id_ManagementDatabase.forEach((a)=> {
				if(a.PING) {
					//PINGの発信元をbuf（Advertise用）に登録する
					buf += ( '00' +  Number(a.ID)).slice( -2 )
					count++
					//同時に、自分の隣接ノード情報として登録しておく
					my_neighbor.push(a.ID)
				}
			})

			//buf==null は周囲にPING発信がないことをを示す
			if(buf == null) return
			AdvertisingData(makeRoutingPacket(5, count, buf))
			console.log(makeRoutingPacket(5, count, buf).toString())
			//自分の隣接ノード情報をid_ManagementDatabaseに登録する
			id_ManagementDatabase.forEach((a)=>{
				if(a.ID == myid) {
					a.NeighborInfo = my_neighbor
					a.NeighborInfo_Update = true
				}
			})
		}
	}
	linkBuildTimer = setInterval(makelink, 5000)
}

var NeighborInfoReceiveProcess = (data) => {
	var i					//ループカウンタ
	//ノードのID
	var sender_id = getRoSenderId(data)
	//残ホップ数
	var hop_remain = getRoHopRemain(data)
	//隣接ノード数
	var neighbor_node_num = getRoNeighborNum(data)
	
	//送信元ノードの隣接情報をまとめる
	var node = new neighborInfo(sender_id)
	for(i=0; i<neighbor_node_num; i++){
		node.push(getRoNeighborID(data, i))
	}
	id_ManagementDatabase.forEach((a)=>{
		if(a.ID == sender_id) {
			a.NeighborInfo = node
			a.NeighborInfo_Update = true
		}
	})
}

var UpdateRoutingTable = ()=>{
	var RoutingTimer = null

	var Routing = function(){
		if(client_switch == false){
			//ルーティングに含めるノードを入れる配列
			var terminals = []
			var my_node

			//ルーティングに含めるノードを配列に入れる
			//a.neighborInfoには、ノードaのIDとその隣接情報が入っている
			id_ManagementDatabase.forEach((a)=>{
				if(a.NeighborInfo_Update) {
					terminals.push(a.NeighborInfo)
					a.NeighborInfo_Update = false
				}
				if(a.ID == myid) my_node = a.NeighborInfo
			})
			if(terminals.length == 0){
				console.log("Nobody is here")
				return
			}
			if(my_node == null) {
				console.log("setting my_node error")
				return
			}
			if(terminals[1] == null) return
			
			MakeRoutingTable(terminals, my_node)
		}
	}

	RoutingTimer = setInterval(Routing, 10000)
}

// メッセージを送信する関数
////	destination_id	宛先
////	message			送信するメッセージ
var SendMessage = (destination_id, message = String(test_num)) => {
	//ネットワーク内にいるか確認
	if(myid == 1){
	if(client_switch == false){
		if(destination_id != 0){
			var flag_found = false
			var flag_link = false
			//宛先のリンク確認
			id_ManagementDatabase.forEach((a) => {
				if(a.ID == destination_id){
					if(a.PING == true){
						//リンクは有効である
						flag_link = true
					}
					flag_found = true
				}
			})
			
			if(flag_found == false) {
				console.log("宛先ID：", destination_id, "	未登録")
				return
			}
			if(flag_link == false) {
				console.log("宛先ID：", destination_id, "	リンク無効")
				return
			}
		}

		//使用可能なデータIDの問い合わせ
		var available_data_id = 1
		ResendPreventionDatabase.forEach((a) => {
			if(a.SenderID == myid) {

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
		
		/** 実験用 **/
		message = message + "|" + myid + "=>"
		/************/

		var buf = makeMessagePacket(destination_id, myid, available_data_id, 1, 1, 5, message)	
		AdvertisingData(buf)
		test_num++
		console.log("「",getMeMassage(buf), "」")
		

		
	}
	}
	console.log(ResendPreventionDatabase)
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
					found_flag = true
				}
	})
	
	//登録済みならフラグで関数を抜ける
	if(found_flag) return
	
	//再送防止用データベースに登録する
	resendPush(sender_id, data_id, sequence_no)

	//宛先を調べてそれぞれの処理を行う
	if(destination_id == myid){
		console.log("自分宛て「", message, "」")

		/** 実験用 **/
		message = message + "=>" + myid
		/************/
		FileOutput("Output.txt", message)

	}else if(destination_id == 0){
		//ブロードキャストの場合はパケットの中継も行う
		console.log("ブロードキャスト「", message, "」")
		AdvertisingData(data)
	}else{
		//他者へのメッセージは中継する
		console.log("他者へのメッセージ")

		/** 実験用 **/
		message = message +  myid
		/************/

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

		}else if(data.toString('ascii', 0, 2) == 'Me'){
			//メッセージパケット受信時の処理
			if(client_switch) return
			if(newer_handling) return
			MassageReceiveProcess(data)
		}else if(data.toString('ascii', 0, 2) == 'Ro'){
			if(client_switch) return
			if(newer_handling) return
			//あるノードの隣接情報を受信したとき
			NeighborInfoReceiveProcess(data)
		}
	})
	
	/////////////////////////////////////////////////////////
	
}
	

// ~~~~~~~~~~~~~~~~~~~~~~~~~初期化処理の定義 おわり~~~~~~~~~~~~~~~~~~~~~~~~~~~//


InitialProcess()
MainProcess()
setTimeout(join, 1000)
setTimeout(DoPing, 1000)
LinkRebuild()
setTimeout(UpdateRoutingTable, 5000)

var messageTestTimer = null
//setIntervalは関数実行中でも他のタイマーの呼び出しで中断される
//複数使うときはタイミングをずらしてかぶらないようにする
setTimeout(()=> {
	messageTestTimer = setInterval(SendMessage, 10000, 0)
},2000)
