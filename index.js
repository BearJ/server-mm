/**
 * Created by jfengjiang on 2014/12/5.
 * Updated by bearverygood on 2015/9/29.
 */

var fs = require('fs');
var path = require('path');
var url = require('url');
var http = require('http');

var lodash = require('lodash');
var socket = require('socket.io');
var parseurl = require('parseurl');
var iconv = require('iconv-lite');

var tmpl = require('./lib/tmpl');

/**
 * _sockets
 * @type {Array}
 */
var _sockets = [];

/**
 * handler
 * @param {Object} opts
 * @returns {Function}
 */
function handler(opts){

    var MINE = { '.bmp': 'image/bmp', '.css': 'text/css', '.doc': 'application/msword', '.dtd': 'text/xml', '.gif': 'image/gif', '.hta': 'application/hta', '.htc': 'text/x-component', '.htm': 'text/html', '.html': 'text/html', '.tmpl': 'text/html', '.xhtml' : 'text/html', '.ico': 'image/x-icon', '.jpe': 'image/jpeg', '.jpeg': 'image/jpeg', '.jpg': 'image/jpeg', '.js': 'text/javascript', '.json': 'application/json', '.mocha' : 'text/javascript', '.mp3': 'audio/mp3', '.mp4': 'video/mpeg4', '.mpeg': 'video/mpg', '.mpg': 'video/mpg', '.manifest' : 'text/cache-manifest', '.pdf': 'application/pdf', '.png': 'image/png', '.ppt': 'application/vnd.ms-powerpoint', '.rmvb': 'application/vnd.rn-realmedia-vbr', '.rm': 'application/vnd.rn-realmedia', '.rtf': 'application/msword', '.svg': 'image/svg+xml', '.swf': 'application/x-shockwave-flash', '.tif': 'image/tiff', '.tiff': 'image/tiff', '.txt': 'text/plain', '.vml': 'text/xml', '.vxml': 'text/xml', '.wav': 'audio/wav', '.wma': 'audio/x-ms-wma', '.wmv': 'video/x-ms-wmv', '.woff': 'image/woff', '.xml': 'text/xml', '.xls': 'application/vnd.ms-excel', '.xq': 'text/xml', '.xql': 'text/xml', '.xquery' : 'text/xml', '.xsd': 'text/xml', '.xsl': 'text/xml', '.xslt': 'text/xml'};
    var socketjs = fs.readFileSync(__dirname + '/lib/socket.io-1.3.4.js', 'utf8');

    return function(req, res){
        if (req.method !== 'GET' && req.method !== 'HEAD') {
            res.statusCode = 404;
            return res.end('not found');
        }

        var pathname = parseurl(req).pathname;

        var abs = path.join(opts.root, pathname);

        // 如果文件不存在，尝试fileNotFoundFunc来改路径
        if(!fs.existsSync(abs) && opts.fileNotFoundFunc){
            abs = opts.fileNotFoundFunc(path.join(opts.root, parseurl(req).path));
        }
        // 如果文件还是不存在，输出404
        if(!fs.existsSync(abs)){
            res.statusCode = 404;
            return res.end('file: ' + abs + ' not found');
        }

        //如果是目录就列出来
        if (fs.lstatSync(abs).isDirectory()){
            var files = fs.readdirSync(abs);
            var result = fs.readFileSync(__dirname + '/lib/tree.html', 'utf8');
            var render = '';
            files.forEach(function (file) {
                if(file.charAt(0) === '.'){
                    return;
                }
                var isDir = fs.lstatSync(path.join(abs, file)).isDirectory();
                var url = (pathname === '/'? '' : pathname.replace(/\/$/, '')) + '/' + file + (isDir ? '/' : '');
                var icon = isDir ? 'icon_folder' : 'icon_file';
                render += '<a href="'+ url +'" class="item"> <i class="'+ icon +'"></i> <span>'+ file +'</span> </a>'
            });
            result = result.replace('<%= items >', render);

            return res.end(result);
        }

        var extname = path.extname(abs);
        var mine = MINE[extname] ? MINE[extname] : 'text/plain';
        if(mine.indexOf('text') !== -1) mine += '; charset=utf8';

        res.writeHead(200, {
            'Content-Type': mine,
            'Server': 'node',
            'X-Powered-By': 'server-mm'
        });

        // 如果不是html文件，直接输出页面
        if (mine.indexOf('text/html') === -1){
            return fs.createReadStream(abs).pipe(res);
        }

        // 编码判断，opts的为默认，如果检测页面有<%##encode:xxx##%>这种，则为xxx编码
        var content = fs.readFileSync(abs), encoding = opts.encoding, pageEncoding;
        pageEncoding = content.toString().match(/<%##encode:\s*(.*?)##%>/);
        if(pageEncoding && pageEncoding.length > 1) encoding = pageEncoding[1];
        if(!iconv.encodingExists(encoding)) encoding = 'utf8';
        content = iconv.decode(content, encoding).toString();

        // 如果开启了模板编译
        if(opts.tmpl){
            var context = {};
            if(fs.existsSync(opts.tmpl)){
                try{
                    context = eval('(' + fs.readFileSync(opts.tmpl, 'utf8') + ')');
                }catch(err){
                    throw new Error('parse context file error, please check context file ' + opts.tmpl);
                }
            }
            try{
                content = tmpl(content, lodash.extend(context, url.parse(req.url, true).query), abs, encoding);
            }catch(err){
                res.statusCode = 500;
                console.log(err.stack.toString());
                return res.end(err.stack.toString().replace(/\n/g,"<br>"));
            }
        }

        // 如果开启即时预览
        if (opts.live){
            var replacement = '<script>{{socketjs}}</script>\n' +
                '<script>\n' +
                'var socket = io();\n' +
                ' socket.on("change", function(data){\n' +
                'window.location.reload();\n' +
                '});\n' +
                '</script>\n' +
                '</body>\n';
            replacement = replacement.replace('{{socketjs}}', socketjs);
            content = content.replace(/<\/body>/gi, replacement);
        }
        return res.end(content);
    }
}

/**
 * start server
 * @param {Object} options default: {port: 8080}
 */
function start(options){
    var opts = lodash.extend({port: 8080, root: __dirname, encoding: 'utf8', live: true, tmpl: false}, options);
    var app = http.createServer(handler(opts));
    var io = socket(app);

    app.listen(opts.port, function(){
        var url = 'http://127.0.0.1' + (opts.port == 80 ? '' : ':' + opts.port);
        console.log('Server start on ' + url + '.');
        require('child_process').exec('start "" "' + path.join(url, opts.dist || "") + '"');
    });

    // listen with socket
    io.on('connection', function(socket){
        _sockets.push(socket);

        socket.on('disconnect', function(){
            var index = _sockets.indexOf(socket);
            if(index != -1){
                _sockets.splice(index, 1);
            }
        });
    });
}

/**
 * emit socket event
 * @param event
 * @param data
 */
function emit(event, data){
    _sockets.forEach(function(socket){
        if(socket) socket.emit(event, data);
    });
}

module.exports = start;
module.exports.start = start;
module.exports.emit = emit;