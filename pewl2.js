Poules = new Mongo.Collection("poules");

if (Meteor.isClient) {
  // Ce code ne s'exécute que chez le client

  // HELPERS

  Template.body.helpers({
    poules: function() {
      if (Session.get("hideUneditable")) {
        // Si on veut masquer les non-éditables, on ajoute un filtre
        return Poules.find({editable: {$ne: false}});
      } else {
        return Poules.find({});  
      }
    },
    hideUneditable: function() {
      return Session.get("hideUneditable");
    },
    poulesCountDisplay: function() {
      var pc = Poules.find({editable: {$ne: false}}).count();
      var disp = "" + pc + " poule";
      if (pc>1)
        return disp+"s";
      return disp;
    }
  });

  // EVENTS

  Template.body.events({
    "submit .new-poule": function (event) {
      // Prevent default browser form submit
      event.preventDefault();

      // Get value from form element
      var pouleName = event.target.text.value;

      Meteor.call("addPoule", pouleName);

      // Clear form
      event.target.text.value = "";

    },
    "change .hide-uneditable input": function(event) {
      Session.set("hideUneditable", event.target.checked);
    }
  }); // Body events

  Template.poule.events({
    "click .toggle-editable": function () {
      // Set the checked property to the opposite of its current value
      Meteor.call("setPouleEditable", this._id, !this.editable);
    },
    "click .delete": function () {
      Meteor.call("deletePoule", this._id);
    },
    "click .poule-cell-case": function(event, template) {
      Meteor.call("increase", template.data._id, "1", "2");
    },
    "click .btn-ajout-tireur": function() {
      Meteor.call("addTireur", this._id);
    }, 
    "click .edit-name": function(event, template) {
      var oldName = event.target.innerHTML.trim();
      var newName = prompt("Renommer le tireur en : ", oldName);

      if (newName != null) {
          Meteor.call("renameTireur", this._id, oldName, newName);
      }

    }
  });
}

Meteor.methods({
  addPoule: function(pouleName) {
    // Insert a task into the collection
    Poules.insert({
      name: pouleName,
      createdAt: new Date(), // current time
      editable: true,
      tireurs: ["Tireur1"],
      cols: [{colId:"1", rows:[{ rowId:"1", val:"#"}] }],
      ratios: [1],
      pvs: [0],
      tds: [0],
      trs: [0],
      gas: [0],
      places: [0]
    });
  },
  deletePoule: function(pouleId) {
    Poules.remove(pouleId);
  },
  setPouleEditable: function(pouleId, setEditable) {
      Poules.update(pouleId, {
        $set: {editable: setEditable}
      });

  },
  addTireur: function(pouleId) {
    var poule = Poules.find({_id: pouleId}).fetch();
    // On ajoute une colonne dans cols
    // Le nombre de tireurs (qui vaudra aussi le nombre de colonnes)
    var n = poule[0].tireurs.length;      
    var name = "Tireur"+(n+1);
    var id = ""+(n+1);
    var col = {
      colId: id,
      rows: new Array()
    }
    for (var i=0; i<n; i++) {
      var randomVal = Math.floor((Math.random() * 100) + 1);
      col.rows.push({
        rowId: ""+(i+1),
        val: randomVal
      });
    }
    
    // On ajoute une colonne supplémentaire
    Poules.update({_id:pouleId}, {
      "$push": {
        tireurs: name,
        cols: col,
        ratios: 1,
        pvs: 0,
        tds: 0,
        trs: 0,
        gas: 0,
        places: 0
      }
    });

    // Enfin on ajoute la dernière case à chacune des colonnes
    // Pas possible côté client ? A tester côté serveur
    var colId = "";
    for (var i=1; i<n+1; i++) {
      colId = ""+i;
      var randomVal = Math.floor((Math.random() * 100) + 1);
      Poules.update({_id:pouleId, "cols.colId": colId}, {
        "$push": { "cols.$.rows" : { rowId: n, val: randomVal } }
      });
    }
    colId = ""+(n+1);
    Poules.update({_id:pouleId, "cols.colId": colId}, {
      "$push": { "cols.$.rows" : { rowId: n, val: "#" } }
    });
  },
  renameTireur: function(pouleId, oldName, newName) {
    console.log("Renommage en : "+newName);
    Poules.update({_id: pouleId, "tireurs": oldName}, {
      "$set": { "tireurs.$" : newName }
    });
  },
  increase: function(pouleId, row, col) {
    // Récupérer la valeur dans la case en question
    var poule = Poules.find({_id: pouleId}).fetch();
    console.log("PouleId : "+pouleId+" row : "+row+" col : "+col);
    var val = poule[0].cols[parseInt(row)].rows[parseInt(col)].val;
    console.log("Val : "+val);
    // L'augmenter de 1
    val += 1;
    // Mettre à jour la valeur dans la table
    /*Poules.update({_id:pouleId, "cols.colId": col, "cols.colId.rowId": row}, {
      "$set": { "cols.$.rows.$.val": val}
    });*/
  }
});