(function (){
  self.importScripts("../bower_components/elasticlunr.js/elasticlunr.js");
  var index = elasticlunr(function ()
      {
        this.addField('title');
        this.addField('body');
        this.setRef('ref');
        this.saveDocument(false);
      });
  self.addEventListener('message', function (e) {
      if (e.data == "done"){
          self.postMessage(JSON.stringify(index));
      }
      index.addDoc(e.data);
      });
}());
