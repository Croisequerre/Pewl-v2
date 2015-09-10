Poules = new Mongo.Collection("poules");

if (Meteor.isClient) {
  // Ce code ne s'exécute que chez le client

  ////////////////////////////
  //         HELPERS        //
  ////////////////////////////

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

  Template.tabletitles.helpers({
    scoreTitles: function() {
      var p = Poules.find({_id:this._id}).fetch();
      var n = p[0].entries.length;
      var tab = new Array();
      for (var i=0; i<n; i++) {
        tab.push(""+(i+1));
      }
      return tab;
    }
  });

  Template.tableentry.helpers({
    isDiese: function(val) {
      return (val === "#");
    },
    isDone: function(state) {
      return (val !== "-");
    }
  });

  ////////////////////////////
  //        EVENTS          //
  ////////////////////////////

  Template.body.events({
    "click .new-poule": function (event) {
      // Prevent default browser form submit
      event.preventDefault();

      // Get value from form element
      var pouleName = prompt("Entrez le nom de votre poule : ", "Poule");

      if (name != null) {
        Meteor.call("addPoule", pouleName);
      }

    },
    "change .hide-uneditable input": function(event) {
      Session.set("hideUneditable", event.target.checked);
    },
    "click .btn-classement": function() {
      Meteor.call("classement");
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
    "click .btn-ajout-tireur": function() {
      var name = prompt("Donner un nom au tireur : ", "Tireur");

      if (name != null) {
          Meteor.call("addTireur", this._id, name);
      }
    },
    "click .btn-score": function() {
      var score = prompt("Entrez un score : ", "j1,j2,score1,score2");

      if (score != null) {
          var t = score.split(',');
          if (t.length != 4) {
            console.log("Erreur dans la saisie");
            console.log(t);
          } else {
            Meteor.call("setScore", this._id, t[0], t[1], t[2], t[3]);
          }
      }
    }
  });

  Template.tableentry.events({
    "click .edit-name": function(event, template) {
      var oldName = event.target.innerHTML.trim();
      var newName = prompt("Renommer le tireur en : ", oldName);
      // On récupère la poule dans laquelle se trouve le tireur que 
      // l'on souhaite renommer
      // Afin de récupérer son n° de poule
      // BOF : est-ce vraiment utile de le faire ici ???
      var p = Poules.find({"entries.id":this.id}).fetch();
      if (newName != null) {
          Meteor.call("renameTireur", p[0]._id, this.id, newName);
      }
    }
  });
}


////////////////////////////
//       METHODES         //
////////////////////////////

Meteor.methods({
  addPoule: function(pouleName) {
    // Insert a task into the collection
    Poules.insert({
      name: pouleName,
      createdAt: new Date(), // Date de création
      editable: true,
      points: {
        victoire: 3,
        nul: 2,
        defaite: 1,
        forfait: 0
      },
      entries: new Array() // Les lignes seront stockées dedans
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
  addTireur: function(pouleId, nom) {
    var poule = Poules.find({_id: pouleId}).fetch();
    // Le nombre de tireurs (qui vaudra aussi le nombre de colonnes)
    var n = poule[0].entries.length;

    // On commence par ajouter une case supplémentaire à chaque tireur
    for (var i=0; i<n; i++) {
      var tid = poule[0].entries[i].id;
      Poules.update({_id:pouleId, "entries.id": tid}, {
        "$push": { "entries.$.results" : { cellId: n, state: "-", val: 0 } }
      });
    }

    // Puis on crée l'entrée supplémentaire
    var res = new Array();
    var id = "";
    for (var i=0; i<n; i++) {
      id = i;
      res.push({
        cellId: id,
        state: "-",
        val: 0
      });
    }
    res.push({
      cellId: n,
      state: "-",
      val: "#"
    });

    var entry = {
      id: Math.floor((Math.random() * 100000000000) + 1),
      tireur: nom,
      results: res,
      ratio: 1,
      pv: 0,
      td: 0,
      tr: 0,
      ga: 0,
      place: 0
    };
    
    // On ajoute la ligne du nouveau tireur
    Poules.update({ _id: pouleId }, {
      "$push": { entries: entry }
    });

    Meteor.call("calculeScore", pouleId);

  },
  renameTireur: function(pouleId, tid, newName) {
    Poules.update({_id: pouleId, "entries.id": tid}, {
      "$set": { "entries.$.tireur" : newName }
    });
  },
  setScore: function(pouleId, t1, t2, scoret1, scoret2) {
    var poule = Poules.find({_id: pouleId}).fetch();
    // Attention, MEGABIDOUILLE
    // cf. http://christian.fei.ninja/updating-dynamic-fields-and-nested-arrays-in-mongodb/
    var setObject = {};
    setObject["entries."+(parseInt(t1)-1)+".results."+(parseInt(t2)-1)+".val"] = parseInt(scoret1);
    var state = Meteor.call("getState", scoret1, scoret2);
    setObject["entries."+(parseInt(t1)-1)+".results."+(parseInt(t2)-1)+".state"] = state;
    setObject["entries."+(parseInt(t2)-1)+".results."+(parseInt(t1)-1)+".val"] = parseInt(scoret2);
    state = Meteor.call("getState", scoret2, scoret1);
    setObject["entries."+(parseInt(t2)-1)+".results."+(parseInt(t1)-1)+".state"] = state;
    Poules.update({ "_id": pouleId }, {
      "$set": setObject
    }, function(err, doc) {
      console.log(err,doc);
    });

    Meteor.call("calculeScore", pouleId);
  },
  getState: function(s1, s2) {
    if (parseInt(s1) > parseInt(s2)) return "v";
    else if (parseInt(s1) < parseInt(s2)) return "d";
    else return "n";
  },
  calculeScore: function(pouleId) {
    var poule = Poules.find({_id: pouleId}).fetch();

    // Le nombre de tireurs (qui vaudra aussi le nombre de colonnes)
    var n = poule[0].entries.length;

    // On commence par ajouter une case supplémentaire à chaque tireur
    var pv, td, tr;
    for (var i=0; i<n; i++) {
      var tid = poule[0].entries[i].id;
      
      td = 0;
      pv = 0;
      for (var j=0; j<n; j++) {
        // Quand i==j, on a un "#" dans le tableau
        if (i != j) {
          td += poule[0].entries[i].results[j].val;

          // Calcul des points de victoire
          // Seulement si le match a eu lieu (pas de calcul si l'état dit "-")
          if (poule[0].entries[i].results[j].state !== "-") {
            if (poule[0].entries[i].results[j].val > poule[0].entries[j].results[i].val)
              pv += poule[0].points.victoire;
            else if (poule[0].entries[i].results[j].val == poule[0].entries[j].results[i].val)
              pv += poule[0].points.nul;
            else if (poule[0].entries[i].results[j].val < poule[0].entries[j].results[i].val)
              pv += poule[0].points.defaite;
          }
        }
      }
      tr = 0;
      for (var j=0; j<n; j++) {
        // Quand i==j, on a un "#" dans le tableau
        if (i != j)
          tr += poule[0].entries[j].results[i].val;
      }
      //console.log("Pour le tireur "+tid+log+" = "+td+" | "+logTr+" = "+tr);
      Poules.update({_id:pouleId, "entries.id": tid}, {
        "$set": { 
          "entries.$.td" : td,
          "entries.$.tr" : tr,
          "entries.$.ga" : (td-tr),
          "entries.$.pv" : pv,
        }
      });
    }

    Meteor.call("calculePlace", pouleId); 

  },
  calculePlace: function(pouleId) {
    // La poule dans laquelle va être calculé le classement
    var poule = Poules.find({_id: pouleId}).fetch();

    // Le nombre de tireurs
    var n = poule[0].entries.length;

    var t = new Array();
    for (var i=0; i<n; i++) {
      t.push({
        id: poule[0].entries[i].id,
        pv: poule[0].entries[i].pv,
        ga: poule[0].entries[i].ga
      });
    }
    // Le classement se fait par PV puis par GA
    // Attention, en cas de GA égaux, aucun classement
    // supplémentaire n'est réalisé
    t.sort(function(a, b) {
      if (a.pv != b.pv) return b.pv-a.pv;
      // sinon
      return b.ga-a.ga;
    });

    for (var i=0; i<n; i++) {
      Poules.update({_id:pouleId, "entries.id": t[i].id}, {
        "$set": { 
          "entries.$.place" : (i+1)
        }
      });
    }
  },
  classement: function() {
    // On récupère toutes les poules
    var poules = Poules.find({}).fetch();

    // Récupération de tous les tireurs dans un tablea
    var tab = new Array();
    for (var i=0; i<poules.length; i++) {
      for (var j=0; j<poules[i].entries.length; j++) {
        tab.push({
          name: poules[i].entries[j].tireur,
          pv: poules[i].entries[j].pv,
          ga: poules[i].entries[j].ga
        })
      }
    }

    // Une fois qu'on a tous les tireurs, on les trie
    tab.sort(function(a, b) {
      if (a.pv != b.pv) return b.pv-a.pv;
      // sinon
      return b.ga-a.ga;
    });

    var msg = "";
    for(var i=0; i<tab.length; i++) {
      msg += (i+1)+" " +tab[i].name+" "+tab[i].pv+" "+tab[i].ga+"\n";  
    }
    alert(msg);

  }
});