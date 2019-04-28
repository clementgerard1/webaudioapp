$(function(){

	if (location.protocol != 'https:')
	{
	 location.href = 'https:' + window.location.href.substring(window.location.protocol.length);
	}

	//Init
	var volumes = [];
	var gains = [];
	var irs = [];
	var input = null;
	var ctx = null;
	var count = 0;
	var reverb = null;
	var delays = [];
	var delaysPans = [];
	var delaysGain = [];
	var delaysFeed = [];
	var delaysPos = [];
	var delayInit = [];
	var delaySize = 0.5;
	var tempo = 120;
	var feedbackDelay = 0.4;
	
	var grainDelays = [];
	var grainGains = [];
	var grainPans = [];
	var grainPhases = [0, 0.25, 0.125, 0.375, 0.075, 0.325, 0.2, 0.4, 0.5, 0.75, 0.625, 0.375, 0.575, 0.825, 0.7, 0.9];
	var toZero = [];
	var updateGrainTime = 5; //ms
	var grainSize = 300;
	var grainFeed = null;
	var grainInput = null;
	var grainFeedDelay = null;
	var grainRandom = 400;
	var feedbackGrain = 0.4;
	var grainF = null;
	var preDelay = 0;
	var rec = null;
	var recNode = null;

	//

	function initAudio(){
		if(!ctx){
			$(".loading").css("display", "flex");
			try {
				ctx = new (window.AudioContext || window.webkitAudioContext)();
				navigator.getUserMedia = navigator.mediaDevices.getUserMedia({ 
					audio : {
						latency: 0.002,
						echoCancellation: false,
						mozNoiseSuppression: false,
						mozAutoGainControl:false
					}
				});

				navigator.mediaDevices.latency = 0.001;

				gains["volumeInput"] = ctx.createGain();
				gains["volumeInput"].gain.setValueAtTime(0.85, ctx.currentTime);
				gains["volumeDelay"] = ctx.createGain();
				gains["volumeDelay"].gain.setValueAtTime(0.85, ctx.currentTime);
				gains["volumeReverb"] = ctx.createGain();
				gains["volumeReverb"].gain.setValueAtTime(0.85, ctx.currentTime);
				gains["volumeGrain"] = ctx.createGain();
				gains["volumeGrain"].gain.setValueAtTime(0.85, ctx.currentTime);
				gains["volumeOutput"] = ctx.createGain();
				gains["volumeOutput"].gain.setValueAtTime(0.85, ctx.currentTime);
				recNode = ctx.createGain();
				gains["volumeOutput"].connect(recNode);
				gains["volumeInput"].connect(recNode);
		 		rec = new Recorder(recNode);

				gains["volumeDelay"].connect(gains["volumeOutput"]);
				gains["volumeGrain"].connect(gains["volumeOutput"]);
				gains["volumeReverb"].connect(gains["volumeOutput"]);

				gains["volumeOutput"].connect(ctx.destination);
				navigator.mediaDevices.getUserMedia ({audio: true})
   				.then(function(stream) {
        		input = ctx.createMediaStreamSource(stream);
        		input.connect(gains["volumeInput"]);
    			});

			}catch(e){
				console.log(e);
				displayError("Your browser isn't able to make work this page, try to update it or change for an other browser.");
				$(".toggles button").off("click");
				$(".toggles .item1").off("click");
				$(".toggles .item2").off("click");
				$(".toggles .item3").off("click");
			}

			for(var i = 1 ; i <= 6 ; i++){

				var request = new XMLHttpRequest();
				request.responseType = 'arraybuffer';
			  request.open('POST', "/IRS/IR" + i + ".mp3", true);
			  request.onreadystatechange = function(event){
				    if (this.readyState === XMLHttpRequest.DONE) {
				        if (this.status === 200) {
				        	  var id = parseInt(this.responseURL.slice(-5, -4)) - 1;
								    ctx.decodeAudioData(this.response, function(buffer){
								    	irs[id] = buffer;
								    	if(reverb && id==3){
								    		reverb.buffer = irs[3];
								    	}
								    	count++;
									    if(count == 6){
									    	$(".loading").hide();
									    }
								    });
				        }
				    }
				};
			  request.send();

			 }
		}
	}

	function initGrain(){

		initAudio();

		if(ctx){
			try {

				if(typeof delays[i] === 'undefined'){
					grainFeed = ctx.createGain();
					grainInput = ctx.createGain();
					grainFeedDelay = ctx.createDelay(1);
					grainFeedDelay.delayTime.value = 0.2;
					grainFeed.gain.setValueAtTime(feedbackGrain, ctx.currentTime);
					grainInput.connect(grainFeed);
					grainFeed.connect(grainFeedDelay);
					grainFeedDelay.connect(grainInput);
					var curTime = ctx.currentTime;
					for( var i = 0 ; i < 16 ; i++){
						toZero[i] = false;
						grainGains[i] = ctx.createGain();
						grainGains[i].gain.setValueAtTime(grainPhases[i], curTime);
						grainDelays[i] = ctx.createDelay(3);
						grainDelays[i].connect(grainGains[i]);
						grainDelays[i].delayTime.setValueAtTime((((Math.random() * grainRandom)) / 1000), ctx.currentTime);
						if (ctx.createStereoPanner) {
						    grainPans[i] = ctx.createStereoPanner();
						    grainPans[i].pan.setValueAtTime((Math.random() * 2) - 1, ctx.currentTime);
						} else {
						    grainPans[i] = ctx.createPanner();
						    grainPans[i].panningModel = 'equalpower';
						    var rand = (Math.random() * 2) - 1;
						    grainPans[i].setPosition(rand , 0, 1 - Math.abs(rand));
						}
						grainGains[i].connect(grainPans[i]);
						grainInput.connect(grainDelays[i]);
					}
				}

				//Fair les phases par incrément de i, période par gestion de updateGrainTime
				grainF = processGrain();
				gains["volumeInput"].connect(grainInput);
				for( var i = 0 ; i < 16 ; i++){
					grainPans[i].connect(gains["volumeGrain"]);
				}

			}catch(e){
				displayError("Your browser isn't able to make work audio granulation, try to update it or change for an other browser.");
				$(".item1").off("click");
			}
		}		
	}

	function processGrain(){
		var actu = ctx.currentTime;
		var pourcent = (actu % (grainSize / 1000)) / (grainSize / 1000);
		pourcent = Math.abs((pourcent * 2) - 1);
		for( var i = 0 ; i < 16 ; i++){
			var newGain = (grainPhases[i] + pourcent) % 1;
			if (newGain < 0.01){
				newGain = 0;
				grainGains[i].gain.linearRampToValueAtTime( newGain * 0.4, actu + 0.1);
				toZero[i] = true;
			}
			if(!toZero[i]){
				grainGains[i].gain.linearRampToValueAtTime( newGain * 0.4, actu + 0.1);
			}
			if(grainGains[i].gain.value < 0.001){
				grainDelays[i].delayTime.setValueAtTime((((Math.random() * grainRandom)) / 1000), ctx.currentTime);
				toZero[i] = false;
			}
		}
		return window.setTimeout(function(){ 
				if(grainOK){
					processGrain();
				}
		}, updateGrainTime);
	}

	function updateGrainFeedback(){
		grainFeed.gain.linearRampToValueAtTime(Math.max(0,feedbackGrain), ctx.currentTime + 0.1);
	}

	function closeGrain(){
		try{
			gains["volumeInput"].disconnect(grainInput);
			for(var i = 0 ; i < 16 ; i++){
				grainPans[i].disconnect(gains["volumeGrain"]);
			}
			window.clearTimeout(grainF);
		}catch(e){
		}
	}

	function initDelays(){

		initAudio();

		if(ctx){
			try {
				for( var i = 0 ; i < 4 ; i++){

					delaysPos[i] = (Math.random() * 3900) + 100; // Random between 100 and 10000
					if(typeof delays[i] === 'undefined'){
						delays[i] = ctx.createDelay(4.5);
						var time = parseInt( delaysPos[i] * delaySize);
						time = time - (time  % (60000 / (tempo * 4)));
						delays[i].delayTime.setValueAtTime( (time / 1000) + preDelay, ctx.currentTime);
						delayInit[i] =  (time / 1000);
						delaysFeed[i] = ctx.createGain();
						delaysGain[i] = ctx.createGain();
						delaysGain[i].gain.setValueAtTime((Math.random() * 0.4) + 0.5, ctx.currentTime);
						delaysFeed[i].gain.setValueAtTime(feedbackDelay, ctx.currentTime);
						delaysFeed[i].connect(delaysGain[i]);
						delaysGain[i].connect(delays[i]);
						delays[i].connect(delaysFeed[i]);
						if (ctx.createStereoPanner) {
						    delaysPans[i] = ctx.createStereoPanner();
						    delaysPans[i].pan.setValueAtTime((Math.random() * 2) - 1, ctx.currentTime);
						} else {
						    delaysPans[i] = ctx.createPanner();
						    delaysPans[i].panningModel = 'equalpower';
						    var rand = (Math.random() * 2) - 1;
						    delaysPans[i].setPosition(rand , 0, 1 - Math.abs(rand));
						}
						delays[i].connect(delaysPans[i]);
					}
					gains["volumeInput"].connect(delays[i]);
					delaysPans[i].connect(gains["volumeDelay"]);
				}
			}catch(e){
				displayError("Your browser isn't able to make work audio delays, try to update it or change for an other browser.");
				$(".item2").off("click");
			}
		}		
	}

	function updateDelayPattern(){
		for(var i = 0 ; i < 4 ; i++){
			delaysGain[i].gain.setValueAtTime((Math.random() * 0.4) + 0.5, ctx.currentTime);
			if (ctx.createStereoPanner) {
			    delaysPans[i].pan.setValueAtTime((Math.random() * 2) - 1, ctx.currentTime);
			} else {
			    var rand = (Math.random() * 2) - 1;
			    delaysPans[i].setPosition(rand , 0, 1 - Math.abs(rand));
			}
			delaysPos[i] = (Math.random() * 3900) + 100;
			delaysGain[i].gain.linearRampToValueAtTime((Math.random() * 0.4) + 0.5, ctx.currentTime + 0.1);
			var time = parseInt( delaysPos[i] * delaySize);
			time = time - (time  % (60000 / (tempo * 4)));
			delays[i].delayTime.linearRampToValueAtTime( (time / 1000) + preDelay, ctx.currentTime + 0.1);
			delayInit[i] = (time / 1000);
		}
	}

	function updateDelaySize(){
		for(var i = 0 ; i < 4 ; i++){
			var time = parseInt( delaysPos[i] * delaySize);
			time = time - (time  % (60000 / (tempo * 4)));
			delays[i].delayTime.linearRampToValueAtTime( time / 1000, ctx.currentTime + 0.1);
		}
	}

	function updateDelayFeedback(){
		for(var i = 0 ; i < 4 ; i++){
			delaysFeed[i].gain.linearRampToValueAtTime(feedbackDelay, ctx.currentTime + 0.1);
		}
	}

	function initReverb(){

		initAudio();
		
		if(ctx){
			try {
				if(!reverb){
					reverb = ctx.createConvolver();
					reverb.buffer = irs[3];
				}
				gains["volumeInput"].connect(reverb);
				reverb.connect(gains["volumeReverb"]);
			}catch(e){
				displayError("Your browser isn't able to make work audio reverberation, try to update it or change for an other browser.");
				$(".item3").off("click");
			}
		}else{
			initAudio();
		}

	}

	function closeReverb(){
		try{
			gains["volumeInput"].disconnect(reverb);
			reverb.disconnect(gains["volumeReverb"]);
		}catch(e){

		}
	}

	function closeDelays(){
		try{
			for(var i = 0 ; i < 4 ; i++){
				gains["volumeInput"].disconnect(delays[i]);
				delaysPans[i].disconnect(gains["volumeDelay"]);
			}
		}catch(e){

		}
	}

	function displayError(text){
		$(".error p").text(text);
		$(".error").css("display", "flex");
		setTimeout(function(){
			var ev = $("body").on("click", function(event){
				$(".error").css("display", "none");
				$("body").off(event);
			});
		}, 200);
	}

	function displayLoading(){
		$(".loading").css("display", "flex");
	}

	//Nav
	$(".item1").on("click", function(){
		$("#menu .item1").attr("class", "item1 selected");
		$("#menu .item2").attr("class", "item2");
		$("#menu .item3").attr("class", "item3");
		$("#multidelay").attr("class", "selected");
		$("#reverb").attr("class", "");
		$("#grain").attr("class", "");
	});

	$(".item2").on("click", function(){
		$("#menu .item1").attr("class", "item1");
		$("#menu .item2").attr("class", "item2 selected");
		$("#menu .item3").attr("class", "item3");
		$("#multidelay").attr("class", "");
		$("#reverb").attr("class", "selected");
		$("#grain").attr("class", "");
	});

	$(".item3").on("click", function(){
		$("#menu .item1").attr("class", "item1");
		$("#menu .item2").attr("class", "item2");
		$("#menu .item3").attr("class", "item3 selected");
		$("#multidelay").attr("class", "");
		$("#reverb").attr("class", "");
		$("#grain").attr("class", "selected");
	});

	var multidelayOK = false;

	$(".toggles .multidelaytoggle button").on("click",function(){
		multidelayOK = !multidelayOK;
		if(multidelayOK){
			initDelays();
			$(".toggles .multidelaytoggle button").attr("class", "btn btn-default on");
			$(".toggles .multidelaytoggle button").text("ON ");
			$("#multidelay").css("opacity", 1);
			$("#multidelay input, #multidelay button").attr("disabled", false);
		}else{
			closeDelays();
			$(".toggles .multidelaytoggle button").attr("class", "btn btn-default off");
			$(".toggles .multidelaytoggle button").text("OFF");
			$("#multidelay").css("opacity", 0.3);
			$("#multidelay input, #multidelay button").attr("disabled", true);
		}
	});

	var reverbOK = false;

	$(".toggles .reverbtoggle button").on("click",function(){
		reverbOK = !reverbOK;
		if(reverbOK){
			initReverb();
			$(".toggles .reverbtoggle button").attr("class", "btn btn-default on");
			$(".toggles .reverbtoggle button").text("ON ");
			$("#reverb").css("opacity", 1);
			$("#reverb button").attr("disabled", false);
		}else{
			closeReverb();
			$(".toggles .reverbtoggle button").attr("class", "btn btn-default off");
			$(".toggles .reverbtoggle button").text("OFF");
			$("#reverb").css("opacity", 0.3);
			$("#reverb button").attr("disabled", true);
		}
	});

	var grainOK = false;

	$(".toggles .graintoggle button").on("click",function(){
		grainOK = !grainOK;
		if(grainOK){
			initGrain();
			$(".toggles .graintoggle button").attr("class", "btn btn-default on");
			$(".toggles .graintoggle button").text("ON ");
			$("#grain").css("opacity", 1);
		}else{
			closeGrain();
			$(".toggles .graintoggle button").attr("class", "btn btn-default off");
			$(".toggles .graintoggle button").text("OFF");
			$("#grain").css("opacity", 0.3);
		}
	});

	$("#multidelay .svgcontainer svg").each(function(){
		var mouseState = false;

		$(this).on("touchstart", function(e){
			if(multidelayOK){
				var val = Math.max(0, Math.min($(this).width(), e.touches[0].clientX - $(this)[0].getBoundingClientRect().left));
				$(this).find("circle").css("cx", val);
				if($(this).attr("control") == "size"){
					delaySize = (val / $(this).width()) * 0.9 + 0.1;
					updateDelaySize();
				}else if($(this).attr("control") == "feedback"){
					feedbackDelay = val / $(this).width();
					feedbackDelay *= 0.9;
					updateDelayFeedback();
				}else if($(this).attr("control") == "predelay"){
					preDelay = (val / $(this).width()) * 0.5;
					for(var i = 0 ; i < 4 ; i++){
						delays[i].delayTime.setValueAtTime( delayInit[i] + preDelay, ctx.currentTime + 0.1);
					}
				}
			}
		});

		$(this).on("mousedown", function(e){
			mouseState = true;
			if(multidelayOK){
				var val = Math.max(0, Math.min($(this).width(), e.clientX - $(this)[0].getBoundingClientRect().left));
				$(this).find("circle").css("cx", val);
				
				if($(this).attr("control") == "size"){
					delaySize = (val / $(this).width()) * 0.9 + 0.1;
					updateDelaySize();
				}else if($(this).attr("control") == "feedback"){
					feedbackDelay =  val / $(this).width();
					feedbackDelay *= 0.9;
					updateDelayFeedback();
				}else if($(this).attr("control") == "predelay"){
					preDelay = (val / $(this).width()) * 0.5;
					for(var i = 0 ; i < 4 ; i++){
						delays[i].delayTime.setValueAtTime( delayInit[i] + preDelay, ctx.currentTime + 0.1);
					}
				}
			}
		});
		$("body").on("mouseup", function(e){
			mouseState = false;
		});

		$(this).on("touchmove", function(e){
			if(multidelayOK){
				var val = Math.max(0, Math.min($(this).width(), e.touches[0].clientX - $(this)[0].getBoundingClientRect().left));
				$(this).find("circle").css("cx", val);
				if($(this).attr("control") == "size"){
					delaySize = (val / $(this).width()) * 0.9 + 0.1;
					delaySize
					updateDelaySize();
				}else if($(this).attr("control") == "feedback"){
					feedbackDelay = val / $(this).width();
					feedbackDelay *= 0.9;
					updateDelayFeedback();
				}else if($(this).attr("control") == "predelay"){
					preDelay = (val / $(this).width()) * 0.5;
					for(var i = 0 ; i < 4 ; i++){
						delays[i].delayTime.setValueAtTime( delayInit[i] + preDelay, ctx.currentTime + 0.1);
					}
				}
			}
		});

		$(this).on("mousemove", function(e){
			if(multidelayOK){
				if(mouseState){
					var val = Math.max(0, Math.min($(this).width(), e.clientX - $(this)[0].getBoundingClientRect().left));
					$(this).find("circle").css("cx", val);
					if($(this).attr("control") == "size"){
						delaySize = (val / $(this).width()) * 0.9 + 0.1;
						updateDelaySize();
					}else if($(this).attr("control") == "feedback"){
						feedbackDelay = val / $(this).width();
						feedbackDelay *= 0.9;
						updateDelayFeedback();
					}else if($(this).attr("control") == "predelay"){
						preDelay = (val / $(this).width()) * 0.5;
						for(var i = 0 ; i < 4 ; i++){
							delays[i].delayTime.setValueAtTime( delayInit[i] + preDelay, ctx.currentTime + 0.1);
						}
					}
				}
			}
		});

	});

	$("#grain .svgcontainer svg").each(function(){
		var mouseState = false;

		$(this).on("touchstart", function(e){
			if(grainOK){
				var val = Math.max(0, Math.min($(this).width(), e.touches[0].clientX - $(this)[0].getBoundingClientRect().left));
				$(this).find("circle").css("cx", val);
				if($(this).attr("control") == "size"){
					grainSize = (val / $(this).width()) * 2900 + 100;
				}else if($(this).attr("control") == "feedback"){
					feedbackGrain = val / $(this).width();
					feedbackGrain *= 0.8;
					updateGrainFeedback();
				}else if($(this).attr("control") == "random"){
					grainRandom =  Math.min(3000, (val / $(this).width()) * 2900 + 100);
				}
			}
		});

		$(this).on("mousedown", function(e){
			mouseState = true;
			if(grainOK){
				var val = Math.max(0, Math.min($(this).width(), e.clientX - $(this)[0].getBoundingClientRect().left));
				$(this).find("circle").css("cx", val);
				if($(this).attr("control") == "size"){
					grainSize = (val / $(this).width()) * 2900 + 100;
				}else if($(this).attr("control") == "feedback"){
					feedbackGrain = val / $(this).width();
					feedbackGrain *= 0.8;
					updateGrainFeedback();
				}else if($(this).attr("control") == "random"){
					grainRandom = Math.min(3000, (val / $(this).width()) * 2900 + 100);
				}
			}
		});
		$("body").on("mouseup", function(e){
			mouseState = false;
		});

		$(this).on("touchmove", function(e){
			if(grainOK){
				var val = Math.max(0, Math.min($(this).width(), e.touches[0].clientX - $(this)[0].getBoundingClientRect().left));
				$(this).find("circle").css("cx", val);
				if($(this).attr("control") == "size"){
					grainSize = (val / $(this).width()) * 2900 + 100;
				}else if($(this).attr("control") == "feedback"){
					feedbackGrain = val / $(this).width();
					feedbackGrain *= 0.8;
					updateGrainFeedback();
				}else if($(this).attr("control") == "random"){
					grainRandom =  Math.min(3000, (val / $(this).width()) * 2900 + 100);
				}
			}
		});

		$(this).on("mousemove", function(e){
			if(mouseState){
				if(grainOK){
					var val = Math.max(0, Math.min($(this).width(), e.clientX - $(this)[0].getBoundingClientRect().left));
					$(this).find("circle").css("cx", val);
					if($(this).attr("control") == "size"){
						grainSize = (val / $(this).width()) * 2900 + 100;
					}else if($(this).attr("control") == "feedback"){
						feedbackGrain = val / $(this).width();
						feedbackGrain *= 0.8;
						updateGrainFeedback();
					}else if($(this).attr("control") == "random"){
						grainRandom =  Math.min(3000, (val / $(this).width()) * 2900 + 100);
					}
				}
			}
		});

	});

	$(".input svg, .output svg, .volume svg").each(function(){

		var mouseState = false;

		$(this).on("touchstart", function(e){
			$(this).find("rect").attr("height", Math.max(0, e.touches[0].clientY - $(this)[0].getBoundingClientRect().top - 2));
			updateVolume($(this).attr("id"), 1 - ((e.touches[0].clientY - $(this)[0].getBoundingClientRect().top) / 150));
		});

		$(this).on("mousedown", function(e){
			mouseState = true;
			$(this).find("rect").attr("height", Math.max(0, e.clientY - $(this)[0].getBoundingClientRect().top - 2));
			updateVolume($(this).attr("id"), 1 - ((e.clientY - $(this)[0].getBoundingClientRect().top) / 150));
		});
		$("body").on("mouseup", function(e){
			mouseState = false;
		});

		$(this).on("touchmove", function(e){
			$(this).find("rect").attr("height", Math.max(0, e.touches[0].clientY - $(this)[0].getBoundingClientRect().top - 2));
			updateVolume($(this).attr("id"), 1 - ((e.touches[0].clientY - $(this)[0].getBoundingClientRect().top) / 150));
		});

		$(this).on("mousemove", function(e){
			if(mouseState){
				$(this).find("rect").attr("height", Math.max(0, e.clientY - $(this)[0].getBoundingClientRect().top - 2));
				updateVolume($(this).attr("id"),1 - ((e.clientY - $(this)[0].getBoundingClientRect().top) / 150));
			}
		});
	});

	$("#reverb button").each(function(index){
		var i = index;
		$(this).on("click", function(){
			$("#reverb button").attr("class", "btn btn-default");
			$(this).attr("class", "btn btn-default selected");
			reverb.buffer = irs[i];
		});
	});

	$(".tempo input").on("change", function(){
		tempo = $(this).val();
		updateDelaySize();
	})

	$("#multidelay button").on("click", function(){
		updateDelayPattern();
	});

	// Gestion des volums
	function updateVolume(id, value){
		if(value != volumes[id]){
			volumes[id] = value;
			value = Math.pow(value, 3) * 1.2;
			gains[id].gain.linearRampToValueAtTime( value, ctx.currentTime + 0.1);
		}
	}

	var record = false;
	$(".recordtoggle span").on("click",function(){

		initAudio();

		if(!record){
			$(".recordtoggle span").text("STOP");
			$("#download-link").attr("class", "noactive");
			rec.record();
			record = true;
		}else{
			$(".recordtoggle span").text("REC");
			rec.stop();
 			rec.exportWAV(function(buffers){
 				var url = URL.createObjectURL(buffers);
 				var link = $("#download-link");
 				link.attr("class", "active");
		    link.attr("href", url);
		    link.attr("download", "track.wav");
		    link.trigger("click");
		    record = false;
 			});
		}
	});


});