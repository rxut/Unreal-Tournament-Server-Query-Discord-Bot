const config = require('./config.json');
const Promise = require('promise');
const dgram = require('dgram');
const ServerResponse = require('./serverResponse');
const dns = require('dns');
const Servers = require('./servers');
const Channels = require('./channels');
const Database = require('./db');



class UT99Query{

    constructor(discord, bAuto){

        this.db = new Database();
        this.db = this.db.sqlite;
        this.server = null;

        this.responses = [];

        this.bAuto = false;

        if(bAuto !== undefined){
            this.bAuto = true;
        }

        this.createClient();

        this.servers = new Servers();
        this.channels = new Channels();
        this.discord = discord;

        this.autoQueryLoop = null;

        this.init();

    }

    init(){

        setInterval(() =>{

            //console.log(`Total Responses = ${this.responses.length} (${this.bAuto})`);

            const now = Math.floor(Date.now() * 0.001);

            let r = 0;

            for(let i = 0; i < this.responses.length; i++){

                r = this.responses[i];
      
                if(now - r.timeStamp > config.serverTimeout && !r.bSentMessage){

                    r.bReceivedFinal = true;
                    r.bTimedOut = true;

                    //console.log(`Timed out.`);
                    //console.log(r);

                    if(r.type !== "basic"){
                        r.sendFullServerResponse();
                    }else{

                        r.bSentMessage = true;
                    }

                    continue;
                }
            }

            this.responses = this.responses.filter((a) =>{

                if(!a.bSentMessage){
                    return true;
                }
            });

        }, (config.serverTimeout * 2) * 1000);


        if(this.bAuto){

            this.startAutoQueryLoop();
        
            this.initServerPingLoop();
        }
    }


    deleteAllBasic(){

        const potatoes = [];

        let r = 0;

        for(let i = 0; i < this.responses.length; i++){

            r = this.responses[i];

            if(r.type !== "basic"){

                potatoes.push(r);
            }
        }

        this.responses = potatoes;
    }


    async pingAllServers(){

       // return;
        //MEMORY LEAK HERHEHREHRHEHREHRHEHREHRHEHREHER
        //MEMORY LEAK HERHEHREHRHEHREHRHEHREHRHEHREHER
        //MEMORY LEAK HERHEHREHRHEHREHRHEHREHRHEHREHER
        //MEMORY LEAK HERHEHREHRHEHREHRHEHREHRHEHREHER
        //MEMORY LEAK HERHEHREHRHEHREHRHEHREHRHEHREHER
        //MEMORY LEAK HERHEHREHRHEHREHRHEHREHRHEHREHER
        //MEMORY LEAK HERHEHREHRHEHREHRHEHREHRHEHREHER
        //MEMORY LEAK HERHEHREHRHEHREHRHEHREHRHEHREHER
        //MEMORY LEAK HERHEHREHRHEHREHRHEHREHRHEHREHER
        //MEMORY LEAK HERHEHREHRHEHREHRHEHREHRHEHREHER
        //MEMORY LEAK HERHEHREHRHEHREHRHEHREHRHEHREHER
        //MEMORY LEAK HERHEHREHRHEHREHRHEHREHRHEHREHER

        try{

            this.deleteAllBasic();

            const servers = await this.servers.getAllServers();
            
            //console.table(servers);

            //this.getBasicServer('139.162.235.20', 7777);

            for(let i = 0; i < servers.length; i++){
        
                //setTimeout(() =>{

                await this.getBasicServer(servers[i].ip, servers[i].port);

               // },500);                
            }

        }catch(err){
            console.trace(err);
        }
    }


    updateAutoQueryMessage(channel, messageId, serverInfo){

        return new Promise((resolve, reject) =>{

            if(messageId !== '-1'){

                channel.messages.fetch(messageId).then(() =>{

                    this.getFullServer(serverInfo.ip, serverInfo.port, channel, true, messageId);

                    resolve();

                }).catch((err) =>{
                    
                    console.log(`Message has been deleted ${err}`);
                    
                    this.getFullServer(serverInfo.ip, serverInfo.port, channel);

                    resolve();
                });
       
            }else{

                this.getFullServer(serverInfo.ip, serverInfo.port, channel);
                console.log("Message doesn't exist");
            }

        });
    }

    startAutoQueryLoop(){

        this.autoQueryLoop = setInterval(async () =>{

            const queryChannelId = await this.channels.getAutoQueryChannel();

            if(queryChannelId !== null){

                this.discord.channels.fetch(queryChannelId).then(async (channel) =>{

                    const servers = await this.servers.getAllServers();  
                    
                    if(config.bAutoQueryMessagesOnly){

                        const serverMessageIds = [];
                        
                        for(let i = 0; i < servers.length; i++){

                            if(serverMessageIds.indexOf(servers[i].last_message) === -1){
                                serverMessageIds.push(servers[i].last_message);
                            }
                        }


                        const autoQueryInfoPostId = await this.channels.getAutoQueryMessageId();

                        let messages = await channel.messages.fetch({"limit": 20});

                        messages = messages.array();

                        for(let i = 0; i < messages.length; i++){


                            //console.log(i);
                            //console.log(`autoQueryInfoPostId = ${autoQueryInfoPostId}`);
                            if(autoQueryInfoPostId !== null){

                                if(messages[i].id == autoQueryInfoPostId){
                                    //console.log("FOUND AUTO QUERY MESSAGE ID");
                                    continue;
                                }
                            }

                            if(!messages[i].author.bot || serverMessageIds.indexOf(messages[i].id) === -1){

                                await messages[i].delete().then(() =>{

                                    console.log("Old message deleted");

                                }).catch((err) =>{
                                    console.trace(err);
                                });
                            }
                        }
                    }  

                    for(let i = 0; i < servers.length; i++){

                        setTimeout(async () =>{
                            await this.updateAutoQueryMessage(channel, servers[i].last_message, servers[i]);
                        }, 500);     
                    }
                    
                }).catch((err) =>{
                    console.trace(err);
                });



            }else{

                //console.log(`AutoqueryChannel is not SET!`);
            }

        }, config.autoQueryInterval * 1000);
    }


    initServerPingLoop(){

        //this.pingAllServers();

        this.pingLoop = setInterval(async () =>{

            //console.log("PING INTERVAL")
            
            await this.pingAllServers();

        }, config.serverInfoPingInterval * 1000);
    }

    createClient(){

        this.server = dgram.createSocket("udp4");

        this.server.on('message', (message, rinfo) =>{

            //message = message.toString();
           // console.log(`*******************************************************`);
           // console.log(`${message}`);
           // console.log(`-------------------------------------------------------`);

            const matchingResponse = this.getMatchingResponse(rinfo.address, rinfo.port - 1);

            //BUFFER IS CAUSING THE MEMORY LEAK

            //MOVE PARSING STUFF INSIDE THIS CLASS NOT SERVER RESPOSE

            if(matchingResponse !== null){

          

                //matchingResponse.parsePacket(message);


                this.parsePacket(message, matchingResponse);

                //if(!matchingResponse.parsePacket(message)){

                   // this.getMatchingResponse(rinfo.address, rinfo.port - 1, matchingResponse.timeStamp);
                //}

            }else{
                console.log("There is no matching data for this server");
            }

        });

        this.server.on('listening', () =>{
            console.log("Query port listening");
        });

        this.server.on('error', (err) =>{
            console.trace(err);
        });

       // console.log(`this.bAuto = ${this.bAuto}`);
        if(!this.bAuto){
            this.server.bind(config.udpPort);
        }else{
            this.server.bind(config.udpPortAuto);
        }
    }

    async parsePacket(data, response){

        try{

            this.parseServerInfoData(data, response);

            this.parseMapData(data, response);

            if(response.type !== "basic"){

                this.parseTeamData(data, response);
                this.parseMutators(data, response);
                this.parsePlayerData(data, response);
            }

            const finalReg = /\\final\\$/i;

            if(finalReg.test(data)){

                if(response.type == "full"){

                    response.sendFullServerResponse();
                    return true;

                }else if(response.type == "basic"){

                    response.bSentMessage = true;
                   
                    //data.name, data.currentPlayers, data.maxPlayers, data.gametype, data.mapName, now, data.ip, data.port
                    const potato = {
                        "name": response.name,
                        "currentPlayers": response.currentPlayers,
                        "maxPlayers": response.maxPlayers,
                        "gametype": response.gametype,
                        "mapName": response.mapName,
                        "ip": response.ip,
                        "port": response.port
                    };
                    await this.servers.updateInfo(potato);
                    
                    return true;

                }else if(response.type == "players"){

                    response.sendPlayersResponse();
                    return true;

                }else if(response.type == "extended"){

                    response.sendExtendedResponse();
                    return true;
                }
            }

            return false;

        }catch(err){
            console.trace(err);
        }
    }

    parseServerInfoData(data, response){


        const regs = [
            /\\hostname\\(.+?)\\/i,
            /\\gametype\\(.+?)\\/i,
            /\\numplayers\\(\d+?)\\/i,
            /\\maxplayers\\(\d+?)\\/i,
            /\\maxteams\\(\d+?)\\/i,
            /\\gamever\\(\d+?)\\/i,
            /\\minnetver\\(\d+?)\\/i,
            /\\timelimit\\(\d+?)\\/i,
            /\\goalteamscore\\(\d+?)\\/i,
            /\\fraglimit\\(\d+?)\\/i,
            /\\mutators\\(.+?)\\/i,
            /\\timelimit\\(.+?)\\/i,
            /\\remainingtime\\(.+?)\\/i,
            /\\protection\\(.+?)\\/i,
            /\\listenserver\\(.+?)\\/i,
            /\\changelevels\\(.+?)\\/i,
            /\\balanceteams\\(.+?)\\/i,
            /\\playersbalanceteams\\(.+?)\\/i,
            /\\friendlyfire\\(.+?)\\/i,
            /\\tournament\\(.+?)\\/i,
            /\\gamestyle\\(.+?)\\/i,
            /\\password\\(.+?)\\/i,
            /\\adminname\\(.+?)\\/i,
            /\\adminemail\\(.+?)\\/i,
            /\\countrys\\(.+?)\\/i,
        ];

        const keys = [
            "name",
            "gametype",
            "currentPlayers",
            "maxPlayers",
            "maxTeams",
            "serverVersion",
            "minClientVersion",
            "timeLimit",
            "goalscore",
            "goalscore",
            "mutators",
            "timeLimit",
            "remainingTime",
            "protection",
            "dedicated",
            "changeLevels",
            "balancedTeams",
            "playersBalanceTeams",
            "friendlyFire",
            "tournament",
            "gamestyle",
            "password",
            "adminName",
            "adminEmail",
            "country"

        ];

        let result = "";


        const tOrF = [
            "dedicated",
            "changeLevels",
            "balancedTeams",
            "playersBalanceTeams",
            "tournament",
            "password",
        ];

        for(let i = 0; i < regs.length; i++){

            if(regs[i].test(data)){

                result = regs[i].exec(data);

                if(tOrF.indexOf(keys[i]) == -1){

                    response[keys[i]] = result[1];

                }else{

                    result[1] = result[1].toLowerCase();

                    if(result[1] == "false"){
                        response[keys[i]] = false;
                    }else if(result[1] == "true"){
                        response[keys[i]] = true;
                    }             
                }
            }
        }
    }

    parseMapData(data, response){
        
        const mapTitleReg = /\\maptitle\\(.+?)\\/i;
        const mapNameReg = /\\mapname\\(.+?)\\/i;
        
        let result = mapTitleReg.exec(data);
        if(result !== null) response.mapTitle = result[1];

        result = mapNameReg.exec(data);
        if(result !== null) response.mapName = result[1];
        
    }

    parseTeamData(data, response){

        const teamScoreReg = /\\score_(\d)\\(.+?)\\/ig;
        const teamSizeReg = /\\size_(\d)\\(\d+?)\\/ig;

        let result = "";
        
        while(result !== null){

            result = teamScoreReg.exec(data);  
            if(result !== null) response.teams[parseInt(result[1])].score = parseInt(result[2]);

            result = teamSizeReg.exec(data);
            if(result !== null) response.teams[parseInt(result[1])].size = parseInt(result[2]);
        }
    }

    parseMutators(message, response){

        const reg = /\\mutators\\(.+?)\\/i;

        if(reg.test(message)){
            
            const result = reg.exec(message);

            response.mutators = result[1].split(', ');

        }     
    }

    parsePlayerData(data, response){

        const nameReg = /\\player_(\d+?)\\(.+?)\\/ig;
        const fragsReg = /\\frags_(\d+?)\\(.+?)\\/ig;
        const teamReg = /\\team_(\d+?)\\(\d+?)\\/ig;
        const meshReg = /\\mesh_(\d+?)\\(.*?)\\/ig;
        const faceReg = /\\face_(\d+?)\\(.*?)\\/ig;
        const countryReg = /\\countryc_(\d+?)\\(.*?)\\/ig;
        const pingReg = /\\ping_(\d+?)\\(.*?)\\/ig;
        const timeReg = /\\time_(\d+?)\\(.*?)\\/ig;
        const deathsReg = /\\deaths_(\d+?)\\(.*?)\\/ig;
        const healthReg = /\\health_(\d+?)\\(.*?)\\/ig;
        const spreeReg = /\\spree_(\d+?)\\(.*?)\\/ig;

        let result = "";
        let currentMesh = "";

        while(true){

            currentMesh = "";

            result = nameReg.exec(data);

            if(result !== null){
                response.updatePlayer(result[1], "name", result[2]);
            
            }else{
                //console.table(this.players);
                return;
            }

            result = teamReg.exec(data);
            if(result !== null) response.updatePlayer(result[1], "team", result[2]);

            result = meshReg.exec(data);

           // console.log(result);
            if(result !== null){
                currentMesh = result[2].toLowerCase();
                response.updatePlayer(result[1], "mesh", result[2]);
            }

            result = faceReg.exec(data);
            if(result !== null) response.updatePlayer(result[1], "face", result[2]);


            result = countryReg.exec(data);
            if(result !== null) response.updatePlayer(result[1], "country", result[2]);


            result = fragsReg.exec(data);

            if(result !== null) response.updatePlayer(result[1], "frags", parseInt(result[2]));

            result = pingReg.exec(data);

            if(result !== null) response.updatePlayer(result[1], "ping", parseInt(result[2]));

            result = timeReg.exec(data);

            if(result !== null) response.updatePlayer(result[1], "time", parseInt(result[2]));

            result = deathsReg.exec(data);

            if(result !== null) response.updatePlayer(result[1], "deaths", parseInt(result[2]));

            result = healthReg.exec(data);

            if(result !== null) response.updatePlayer(result[1], "health", parseInt(result[2]));

            result = spreeReg.exec(data);

            if(result !== null) response.updatePlayer(result[1], "spree", parseInt(result[2]));
            
        }
    }

    //ADD COUNTRY REG FOR SERVERSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS

    getMatchingResponse(ip, port, ignoreTimeStamp){

        //console.log(`Looking for ${ip}:${port}`);
        let r = 0;

        for(let i = 0; i < this.responses.length; i++){

            r = this.responses[i];

            if(r.ip == ip && r.port == port && !r.bSentMessage){

                if(ignoreTimeStamp === undefined){
                    return r;
                }else{

                    if(r.timeStamp !== ignoreTimeStamp){
                        return r;
                    }
                }
            }
        }

        return null;

    }

    getFullServer(ip, port, message, bEdit, messageId){

        try{

            //console.log(arguments);
            port = parseInt(port);

            if(port !== port){
                throw new Error("Port must be a valid integer!");
            }

            port = port + 1;

            dns.lookup(ip, (err, address) =>{

                if(err) console.trace(err);

                //console.log('address: %j family: IPv%s', address, family);


                if(bEdit === undefined){
                    this.responses.push(new ServerResponse(address, port, "full", message));
                }else{
                    this.responses.push(new ServerResponse(address, port, "full", message, true, messageId));
                }

                this.server.send('\\info\\xserverquery\\\\players\\xserverquery\\\\rules\\xserverquery\\\\teams\\xserverquery\\', port, address, (err) =>{

                    if(err){
                        console.trace(err);
                    }

                });
            });


        }catch(err){
            console.trace(err);
        }
    }

    getBasicServer(ip, port){

        return new Promise((resolve, reject) =>{

            port = parseInt(port);

            if(port !== port){
                //console.trace("port must be a valid integer.");
                reject("port must be a valid integer.");
                //throw new Error("port must be a valid integer.");
            }

            port = port + 1;

            dns.lookup(ip, (err, address) =>{

                if(err) reject(err);

                //MEMORY LEAK
                this.responses.push(new ServerResponse(address, port, "basic"));

                //constructor(ip, port, type, discordMessage, bEdit, messageId)

                this.server.send('\\info\\xserverquery\\', port, address, (err) =>{

                    if(err){
                        reject(err);
                    }

                    resolve();
                });
            });

        });
       
        

    }

    getPlayers(ip, port, message){

        dns.lookup(ip, (err, address) =>{

            if(err) console.trace(err);

            this.responses.push(new ServerResponse(address, port + 1, "players", message));

            this.server.send('\\info\\xserverquery\\\\players\\xserverquery\\', port + 1, address, (err) =>{

                if(err){
                    console.log(err);
                }
            });
        });
    }

    getExtended(ip, port, message){

        dns.lookup(ip, (err, address, family) =>{

            if(err) console.trace(err);

            this.responses.push(new ServerResponse(address, port + 1, "extended", message));

            this.server.send('\\info\\xserverquery\\\\rules\\xserverquery\\', port + 1, address, (err) =>{

                if(err){
                    console.log(err);
                }
            });
        });
    }
}


module.exports = UT99Query;