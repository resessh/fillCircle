var CIRCLE_SPLIT_NUM = 60;

var A = function() {
	var cont_flag = 1
	,	progress = 0
	,	t = function() {
		return new Date().getTime();
		}
	,	raf = window.requestAnimationFrame
		   || window.webkitRequestAnimationFrame
		   || window.mozRequestAnimationFrame
		   || window.oRequestAnimationFrame
		   || window.msRequestAnimationFrame
		   || function(callback){setTimeout(callback, 1000/30);}
	,	transition_list = {
			linear: function(p){ return p }
		,	sineEaseIn: function(p) { return 1-Math.cos(p*Math.PI/2) }
		,	cubicEaseIn: function(p) { return p*p*p*p }
		,	cubicEaseOut: function(p) { p=1-p; return 1-p*p*p*p }
		,	cubicEaseInOut: function(p) { return (p<=0.5)?Math.pow(p*2,4)/2:Math.pow((1-p)*2,4)/2+0.5; }
		,	quinticEaseOut: function(p) { p=1-p; return 1-Math.pow(p, 5) }
		,	nthEaseOut: function(p) { p=1-p; return 1-Math.pow(p, 12) }
		}

	this.start = function(func, duration, callback, transition) {
		cont_flag = 1;
		if ( typeof transition == "string" ) { transition = transition_list[transition] }
			else if ( typeof transition == "function" ) {}
				else { transition = transition_list["linear"] };
		var start_time = t();
		function step(){
			if ( duration ) { progress = ( t() - start_time ) / duration }
				else { progress = t() - start_time };
			if ( progress < 1 || !duration ) {
				func( transition(progress) || progress );
				if (cont_flag == 1) {
					raf(step);
				};
			} else {
				if (typeof callback == "function") {callback()};
			}
		}
		raf(step);
	}
	this.stop = function(callback) {
		cont_flag = 0;
		if (typeof callback == "function") {callback()};
	}
}

var Canvas = function(id) {
	this.DOM = document.getElementById(id);
	if (!this.DOM || !this.DOM.getContext("2d")) {
		return false;
	}
	this.ctx = this.DOM.getContext("2d");
	this.width = 0;
	this.height = 0;
	this.clear_color = "#ddd";
	
	this.refreshWindowInfo();
	this.setResizeHandler();
}
Canvas.prototype = {
	refreshWindowInfo: function() {
		this.width = window.innerWidth;
		this.DOM.width = this.width;
		this.height = window.innerHeight;
		this.DOM.height = this.height;
	},

	setResizeHandler: function() {
		var self = this;
		window.addEventListener("resize", function() { self.refreshWindowInfo.call(self) });
	},

	setClearColor: function(clear_color) {
		this.clear_color = clear_color;
	},

	clear: function() {
		this.ctx.fillStyle = this.clear_color;
		this.ctx.fillRect(0, 0, this.width, this.height);
	},

}

var Fill = function(canvas_object, noise_object) {
	this.canvas = canvas_object;
	this.noise = noise_object;
	this.nodes = [];
	this.attenuation = 0.2;
	this.max_node_num = 1000;
	this.base_r = 0;
	this.hue = 0;
	this.animator = new A();
	this.interval_id = undefined;
}
Fill.prototype = {

	animate: function() {
		var self = this
		self.reset();
		self.refreshHue();
		self.refreshBaseR();
		self.interval_id = setInterval(createNodesOnce, 200);
		animateOnce();

		function animateOnce() {
			self.animator.start(function() {
				self.canvas.clear();
				for ( var i=0; i<self.nodes.length; i++) {
					self.nodes[i].update();
				}

			}, 6000, function(){
				self.animate();
			})
		}

		function createNodesOnce() {
			var count = 0;
			if ( self.nodes.length < self.max_node_num ) {
				for (var i=0; i<200; i++) {
					count += self.createNode();
					if ( count > 7) {
						break;
					}
				}
			}
			nodes = self.nodes;
		}

		return this;
	},

	createNode: function() {
		var w = this.canvas.width
		,	h = this.canvas.height
		,	x = Math.floor(Math.random() * w)
		,	y = Math.floor(Math.random() * h)
		,	r = this.base_r * Math.pow(this.nodes.length, -this.attenuation)
		,	min_r = Number.POSITIVE_INFINITY
		,	LOWER_LIMIT_R = 6;

		for ( var i = 0; i < this.nodes.length; i++ ) {
			var n = this.nodes[i]
			,	p2p_length = Math.sqrt((n.x-x)*(n.x-x) + (n.y-y)*(n.y-y));
			if ( p2p_length < n.r ) { return 0; } else {
				if ( p2p_length - n.r < min_r ) { min_r = p2p_length - n.r; }
			}
		}

		if ( this.nodes.length == 0 ) {
			var node = new Circle(this.canvas, this.noise).init(this.base_r, x, y, this.hue);
			this.nodes.push(node);
			return 1;
		} else {
			if ( min_r != Number.POSITIVE_INFINITY && min_r > LOWER_LIMIT_R ) {
				var node = new Circle(this.canvas, this.noise).init(Math.min(r, min_r), x, y, this.hue);
				this.nodes.push(node);
				return 1;
			}
			return 0;
		}
	},

	reset: function() {
		this.canvas.clear();
		for (var i=0; i<this.nodes.length; i++) {
			delete this.nodes[i];
		}
		this.nodes = [];
		if (this.interval_id) { clearInterval(this.interval_id); }
	},

	refreshHue: function() {
		this.hue = Math.floor(Math.random() * 360);
	},

	refreshBaseR: function() {
		var w = this.canvas.width
		,	h = this.canvas.height;
		this.base_r = Math.sqrt(w*w + h*h) * 0.15 * (Math.random()*2.5+0.5);
	}

}

var Circle = function(canvas_object, noise_object) {
	this.c = canvas_object;
	this.ctx = this.c.ctx;
	this.r = 0;
	this.x = 0;
	this.y = 0;
	this.split_num = CIRCLE_SPLIT_NUM;
	this.middle_duration = 0.6;
	this.middle_r_rate = noise_object.getNoise();
	this.r_rate = [];
	this.duration = 3000;
	this.init_time = new Date().getTime();
	this.grad = null;
	this.grad_start = null;
	this.grad_end = null;
	this.fillStyle = null;
}
Circle.prototype = {
	init: function(r, x, y, hue) {
		this.r = r - 3;
		this.x = x;
		this.y = y;

		this.grad = new GradColor(hue);
		this.grad_start = this.grad.getStartColor();
		this.grad_end = this.grad.getEndColor();
		this.definePathStyle();

		return this;
	},

	update: function() {

		var self = this;
		var progress = ( t() - self.init_time ) / self.duration;
		if ( progress < 1 ) {
			progress = (function(p) { p=1-p; return 1-Math.pow(p, 10);})(progress);
			render(progress);
		} else {
			render(1);
		}

		function render(progress) {
			var ctx = self.ctx;
			ctx.fillStyle = self.fillStyle;
			self.r_rate = self.calcRadRate(progress);
			ctx.beginPath();
			ctx.moveTo(
				progress * self.r_rate[0] * self.r * Math.cos(0) + self.x
			,	progress * self.r_rate[0] * self.r * Math.sin(0) + self.y );
			for (var i=1 ; i < self.split_num ; i++ ) {
				var sheeta = 2 * Math.PI / self.split_num * i;
				ctx.lineTo(
					progress * self.r_rate[i] * self.r * Math.cos(sheeta) + self.x
				,	progress * self.r_rate[i] * self.r * Math.sin(sheeta) + self.y);
			}
			ctx.closePath();
			ctx.fill();
		}

		function t() { return new Date().getTime(); }

	},

	calcRadRate: function(duration) {
		var rate = [];
		if ( duration <= this.middle_duration ) {
			for ( var i in this.middle_r_rate ) {
				rate[i] = this.middle_r_rate[i] * duration/this.middle_duration;
			}
		} else {
			for ( var i in this.middle_r_rate ) {
				var dur_after_half = (duration-this.middle_duration) / (1-this.middle_duration);
				rate[i] = dur_after_half * (1-this.middle_r_rate[i]) + this.middle_r_rate[i];
			}
		}

		return rate;
	},

	definePathStyle: function() {
		var center = Math.floor(this.c.width/2);
		var grad = this.ctx.createLinearGradient(center, 0, center, this.c.height);
		grad.addColorStop(0, this.grad_start);
		grad.addColorStop(1, this.grad_end);

		this.fillStyle = grad;
	}

}

var GradColor = function(hue) {
	this.h = hue;
	this.s = Math.floor(Math.random()*80)+100;
	this.v = Math.floor(Math.random()*100)+80;
}
GradColor.prototype = {

	hsv2Rgb: function(h, s, v) {
		var r, g, b; // 0..255

		while (h < 0) {
			h += 360;
		}

		h = h % 360;

		// 特別な場合 saturation = 0
		if (s == 0) {
			// → RGB は V に等しい
			v = Math.round(v);

			return {'r': v, 'g': v, 'b': v};
		}

		s = s / 255;

		var i = Math.floor(h / 60) % 6,
		f = (h / 60) - i,
		p = v * (1 - s),
		q = v * (1 - f * s),
		t = v * (1 - (1 - f) * s)

		switch (i) {
			case 0 :
				r = v;  g = t;  b = p;  break;
			case 1 :
				r = q;  g = v;  b = p;  break;
			case 2 :
				r = p;  g = v;  b = t;  break;
			case 3 :
				r = p;  g = q;  b = v;  break;
			case 4 :
				r = t;  g = p;  b = v;  break;
			case 5 :
				r = v;  g = p;  b = q;  break;
		}

		r = Math.round(r);
		g = Math.round(g);
		b = Math.round(b);

		return "rgb(" + r + ", " + g + ", " + b + ")";
	},

	getStartColor: function() {
		return this.hsv2Rgb(this.h - 30, this.s, this.v);
	},

	getEndColor: function() {
		return this.hsv2Rgb(this.h, this.s, this.v);
	}
}

var Perlin = function(length, octave_num) {
	length = length || CIRCLE_SPLIT_NUM;
	octave_num = octave_num || 5;
	this.noise_sets = [];
	this.NOISE_SETS_NUM = 100;
	for (var i=0; i<this.NOISE_SETS_NUM; i++) {
		this.noise_sets[i] = movingAverage(calcPerlin(0.53));
	}

	this.getNoise = function() {
		return this.noise_sets[Math.floor(Math.random()*this.NOISE_SETS_NUM)];
	}

	function calcPerlin(persistence) {
		var perlin = [];
		for (var i = 0; i < length; i++) { perlin[i] = 0 };
		var part_num = Math.floor(Math.random()*3+3);
		for (var i = 1; i < octave_num; i++) {
			var op = calcOctavePerlin(part_num * i + Math.floor(Math.random()*(i-1)));
			for (var j = 0; j < length; j++) {
				perlin[j] += op[j] * Math.pow(persistence, i);
			}
		}
		var rotated_perlin=[]
		,	rotate_num = Math.floor(Math.random()*(length-10)+10);
		perlin.forEach(function(e, i, a) {
			var j = i + rotate_num;
			j = (j >= length)? j - length  : j;
			rotated_perlin[j] = perlin[i];
		});
		return rotated_perlin;
	}

	function calcOctavePerlin(split_num) {
		var octave_perlin = [];
		for (var i = 0; i < length; i+=length / split_num) {
			var temp_noise_value = Math.pow(Math.random(),2)+0.3;
			for (var j = i; j < length; j++) {
				octave_perlin[j] = temp_noise_value;
			}
		}

		return octave_perlin;
	}

	function movingAverage(array) {
		var avarage_time = 10;
		var ans = [];
		for (var i = 0; i < array.length; i++) { ans[i] = 0; }
		ans.forEach(function(e, i ,a) {
			for (var j = 0; j < avarage_time; j++) {
				k = (j+i >= array.length)? j + i - array.length : j + i;
				ans[i] += array[k] * hannWindow(j/avarage_time);
			}
		});

		return ans;

		function hannWindow(x) {
			return (0.5 - 0.5*Math.cos(2*Math.PI*x))*0.2;
		}
	}
}

onload = function() {
	c = new Canvas("canvas");
	c.clear();
	p = new Perlin(CIRCLE_SPLIT_NUM, 5);
	f = new Fill(c,p).animate();
}