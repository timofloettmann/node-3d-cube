var fs = require('fs');
var THREE = require('three');
var SoftwareRenderer = require('three-software-renderer');
var jpeg = require('jpeg-js');

/**
 *  EXPRESS
 */

var path = require('path');
var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var clients = [];

app.get('/', function(req, res) {
  	res.sendFile(path.join(__dirname + '/public/index.html'));
});

app.get('/:connectionId.mjpeg', function(req, res) {
	res.writeHead(200, {
	    'Content-Type': 'multipart/x-mixed-replace; boundary=--mjpegboundary',
	    'Cache-Control': 'no-cache',
	    'Connection': 'close',
	    'Pragma': 'no-cache'
	});

	clients[req.params.connectionId].mjpegStream = res;
});

io.on('connection', function(socket) {
	var id = (Math.floor(Math.random() * (999999999999 - 100000000000)) + 100000000000).toString(36);
  	clients[id] = {
  		socket: socket,
  		mjpegStream: null,
  		timeout: null
  	};

  	var scene = new THREE.Scene();
	var cam      = new THREE.PerspectiveCamera(45, 1, 1, 2000);
	var renderer = new SoftwareRenderer();

	var geometry = new THREE.BoxGeometry(30, 30, 30);
	var colors = [new THREE.Color(1, 0, 0), new THREE.Color(0, 1, 0), new THREE.Color(0, 0, 1)];
	for (var i = 0; i < 3; i++) {
	    geometry.faces[4 * i].color = colors[i];
	    geometry.faces[4 * i + 1].color = colors[i];
	    geometry.faces[4 * i + 2].color = colors[i];
	    geometry.faces[4 * i + 3].color = colors[i];
	}
	var material = new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: THREE.FaceColors });
	var box = new THREE.Mesh(geometry, material);

	cam.position.z = 100;
	renderer.setSize(500, 500);
	scene.add(box);

  	socket.emit('connection_id', { connectionId: id });
  	socket.on('rotation_start', function(event) {
  		clearTimeout(clients[id].timeout);

  		var targetRotationX = event.targetRotationX;
  		var targetRotationY = event.targetRotationY;

  		var render = function() {
  			box.rotation.y += (targetRotationX - box.rotation.y) * 0.1;

  			if (box.rotation.x <= 1 && box.rotation.x >= -1) {
  				box.rotation.x += (targetRotationY - box.rotation.x) * 0.1;
  			}

  			if (box.rotation.x > 1) {
  				box.rotation.x = 1;
  			}

  			if (box.rotation.x < -1) {
  				box.rotation.x = -1;
  			}

  			var imageData = renderer.render(scene, cam);
			var jpegImageData = jpeg.encode(imageData, 80);
	  		var res = clients[id].mjpegStream;

			res.write("--mjpegboundary\r\n");
			res.write("Content-Type: image/jpeg\r\n");
			res.write("Content-Length: " + jpegImageData.data.length + "\r\n");
			res.write("\r\n");
			res.write(jpegImageData.data, 'binary');
			res.write("\r\n");

			clients[id].timeout = setTimeout(render, 1000 / 30);
  		};

  		clients[id].timeout = setTimeout(render, 1000 / 30);
	});

	socket.on('rotation_end', function(event) {
		clearTimeout(clients[id].timeout);
	})
});

http.listen(3000, function() {
  console.log('listening on *:3000');
});