/**
 * Created by bearverygood on 2015/4/5.
 * Updated on 2015/9/29.
 */
var fs = require("fs");
var iconv = require("iconv-lite");
var _$$Reg = "\\$([\\(\\)]{0,50})(?:.DATA)?\\$";
var _encoding;
function _addInnerFunc(data, path) {
    var innerFuncs = {
        EasyEncode: function (str) {
            if (!str && str != "0") return "";
            str = str.replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/ /g, "&nbsp;")
                .replace(/'/g, "&#39;")
                .replace(/"/g, "&quot;")
                .replace(/\n/g, "<br>");
            return str;
        },
        SetVar: function(key, val){
            this["var" + key] = val;
            return "";
        },
        GetVar: function(key){
            return this["var" + key];
        },
        GetResFullName: function (str) {
            return str;
        },
        StrCmpNoCase: function (str1, str2, len) {
            return str1.substr(0, len || 0).localeCompare(str2);
        },
        GetDeviceInfo: function (name) {
            if(data[name] === undefined) return "Window";
            return data[name];
        },
        Left:function(str, len){
            return str.substr(0, len);
        },
        GetCurrentDate: function(){
            var date = new Date();
            return date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate();
        },
        Plus: function(a, b){
            return (+a) + (+b);
        },
        Minus: function(a, b){
            return (+a) - (+b);
        },
        Multiply: function(a, b){
            return (+a) * (+b);
        },
        Divide: function (a, b) {
            return Math.floor((+a) / (+b));
        },
        Mod: function (a, b) {
            return (+a) % (+b);
        },
        AppendVar: function (key, value) {
            this["var" + key] = [this["var" + key], value].join('');
            return "";
        }
    };
    for(var func in innerFuncs){
        if(!data[func]) data[func] = innerFuncs[func];
    }
}
function _map(key, data){
    var out = "";

    // 关键字
    if(/^if/.test(key)) out = key + "{";
    else if(/^else\s?if/.test(key)) out = "}" + key.replace("elseif", "else if") + "{";
    else if(/^else/.test(key)) out = "}" + key + "{";
    else if(/^endif/.test(key)) out = "}";
    else out = "', " + key + ", '";

    /^[^']/.test(out) && (out = "\f" + out + "\v");
    return out;
}

function _funcParse(name, args){
    var _args = [];

    if(/if/.test(name)){ // if & else if
        return name + "(" +
            args.replace(/(.*?)(\||&)(.*)/g, function (w, m1, m2, m3) { // <%@if($bear$=bear|$bear$=b)%> -> <%@if($bear$=bear||$bear$=b)%>
                return m1 + m2 + m2 + m3;
            }).replace(/([^\|&]*?)([!=><])([^\|&]*)/g, function (word, cond, equal, val) { // <%@if($bear$=bear)%> -> <%@if($bear$=='bear')%>
                return _funcArgsParse(cond) + (/[!=]/.test(equal) ? equal + "=" : equal) + _funcArgsParse(val);
            })
            + ")";
    }else{ // StrCmpNoCase(GetDeviceInfo(TYPE),iPad,Divide(4,1)) --> args: GetDeviceInfo(Divide(4,1),Divide(4,1)),iPad,Divide(4,1),
        args = argsNoComma = args.replace(/\(([^\(]*)\)/g, function (w, m1) {
            return "(" + m1.replace(/,/g, "#comma#") + ")";
        }).split(",");
        for (var i = 0, len = args.length; i < len; ++i) {
            _args.push(_funcArgsParse(args[i].replace(/#comma#/g,",")));
        }
        return name + "(" + _args.join(",") + ")";
    }

}
function _funcArgsParse(arg){
    var ret = [], argArr = arg.match(/(.*?)\((.*?)\)$/); // func(...)

    if(argArr){
        ret.push(_funcParse(argArr[1], argArr[2]));
    }else{
        ret.push("'" + arg.replace(/\$(.*?)(?:.DATA)?\$/g, function(w, m1){
            return _$$Handler(m1) ? w : "' + " + w + " + '";
        }) + "'"); // <%@GetResFullName($images_path$a.jpg)%> -> <%@GetResFullName('' + $images_path$ + 'a.jpg')%>
    }

    return ret.join(",");
}
function _includeParse(str, path){
    return str.replace(/<%#include\((.*?)\)%>/, function(w, m){
        var filePath, partName, content;
        m = m.split("#");
        m.length > 1 && (partName = m[1]);

        if(m[0]){
            content = fs.readFileSync(path.substring(0, path.replace(/\\/g, "/").lastIndexOf("/") + 1) + (/\.html$/.test(m[0]) ? m[0] : m[0] + ".html"));
            content = iconv.decode(content, _encoding);
        }else{
            content = str;
        }
        if(partName){
            var reg = new RegExp("<%#" + partName + "%>([\\s\\S]*?)<%#/" + partName + "%>");
            content = content.match(reg);
            content = content ? content[1] : ""
        }
        return content;
    });
}

function _$$Handler(str){
    if(/\(|\)|#br#/.test(str) || str.length > 50) return true;
    return false;
}
function tmpl(str, data, path, encoding) {
    if(!str) return "";

    _encoding = encoding;
    while(/<%#include\((.*?)\)%>/.test(str)){
        str = _includeParse(str, path);
    }

    var fnStr = "var p=[]; with(obj){p.push('" +
        str
            .replace(/[\f\v]/g, "")
            .replace(/\n/g, "#br#")
            .replace(/\\/g, "\\\\")
            .replace(/<%##.*?##%>/g, "") // <%##注释##%>
            .replace(/<%#.*?%>(.*?)<%#\/.*?%>/g, "$1") // <%#block%> xxx <%#/block%>
            .replace(/<%@/g, "\f")
            .replace(/%>/g, "\v")
            .replace(/'/g, "\\'")

            .replace(/\f(.*?)\v/g, function (w, m1) {
                m1 = m1
                    .replace(/(.*?)\((.*?)\)\s*$/, function(w, m1, m2){ // <%@StrCmpNoCase(GetDeviceInfo(TYPE),iPad,4)%> -> <%@StrCmpNoCase(GetDeviceInfo('TYPE'),'iPad','4')%>
                        return _funcParse(m1, m2);
                    })
                    .replace(/\$(.*?)(?:.DATA)?\$/g, function (ww, mm1) { // <%@if($xxx$=)%> -> <%@if(xxx=)%>
                        if(!data[mm1]) data[mm1] = "";
                        return _$$Handler(mm1) ? ww : mm1;
                    });
                return _map(m1, data);
            })
            .replace(/\$(.*?)(?:.DATA)?\$/g, function(w, m1){
                if(!data[m1]) data[m1] = "";
                return _$$Handler(m1) ? w : "', " + m1 + ", '";
            }) // <em>$xxx$</em> -> '<em>' + xxx + '</em>'
            .replace(/<%(.*?)\v(.*?)<%\/\1\v/, function(w, m1, m2){
                return "\f for (var i = 0, len = " + m1 + ".length; i < len; ++i) {" +
                    "with (" + m1 + "[i]) {\v " + m2 + "\f} " +
                    "}\v";
            })

            .replace(/\f/g, "');")
            .replace(/\v/g, "p.push('")
        + "');}return p.join('');";

    // console.log("_________TO FUNC:",fnStr);
    var fn = new Function("obj", fnStr);
    _addInnerFunc(data, path);
    return data != undefined ? fn.call(data, data).replace(/#br#/g, "\n") : fn;
}
module.exports = tmpl;