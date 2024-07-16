const http = require('http');
http.createServer(function (req, res) {
    res.write("Notify Spin");
    res.end();
}).listen(8080);
