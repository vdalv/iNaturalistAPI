"use strict";
var _ = require( "underscore" ),
    DBModel = require( "./db_model" ),
    ESModel = require( "./es_model" ),
    Fave = require( "./fave" ),
    Identification = require( "./identification" ),
    QualityMetric = require( "./quality_metric" ),
    Taxon = require( "./taxon" ),
    User = require( "./user" ),
    Model = require( "./model" );

var Observation = class Observation extends Model {

  constructor( attrs, options ) {
    super( attrs );
    this.obscured = !!(this.geoprivacy === "obscured" || this.private_location);
    if( this.observation_photos ) {
      var photosByID = _.object( _.map( this.photos, p => [ p.id, p ] ) );
      _.each( this.observation_photos, op => {
        op.photo = photosByID[op.photo_id];
        delete op.photo_id;
      });
    }
    if( this.project_observations ) {
      _.each( this.project_observations, po => {
        po.project = { id: po.project_id };
        delete po.project_id;
      });
    }
    options = options || { };
    if ( options.session && this.user &&
         this.user.id === options.session.user_id ) {
      // logged in
    } else {
      if( this.obscured ) {
        delete this.place_guess;
      }
      delete this.private_location;
      delete this.private_geojson;
    }
  }

  static preloadInto( arr, localeOpts, callback ) {
    ESModel.fetchBelongsTo( arr, Observation, null, function( ) {
      var observations = arr.map( function( i ) { return i.observation; } );
      Observation.preloadAllAssociations( observations, localeOpts, callback );
    });
  }

  static preloadUsers( obs, callback ) {
    DBModel.fetchBelongsTo( obs, User, callback );
  }

  static preloadIdentifications( obs, callback ) {
    DBModel.fetchHasMany( obs, Identification, "observation_id", callback );
  }

  static preloadFaves( obs, callback ) {
    DBModel.fetchHasMany( obs, Fave, "votable_id", callback );
  }

  static preloadQualityMetrics( obs, callback ) {
    DBModel.fetchHasMany( obs, QualityMetric, "observation_id", callback );
  }

  static preloadAllAssociations( obs, localeOpts, callback ) {
    Observation.preloadIdentifications( obs, function( err ) {
      if( err ) { return callback( err ); }
      Observation.preloadFaves( obs, function( err ) {
        if( err ) { return callback( err ); }
        Observation.preloadQualityMetrics( obs, function( err ) {
          if( err ) { return callback( err ); }
          Observation.preloadTaxaAndUsers( obs, localeOpts, callback );
        });
      });
    });
  }

  static preloadTaxaAndUsers( obs, localeOpts, callback ) {
    var prepareTaxon = function( t ) {
      t.prepareForResponse( localeOpts );
    }
    var withTaxa = _.filter(
      _.flatten( [ obs, _.pluck( obs, "identifications" ) ] ), _.identity
    );
    var withUsers = _.filter(
      _.flatten( [ withTaxa,
        _.pluck( obs, "comments" ),
        _.pluck( obs, "faves" ),
        _.pluck( obs, "quality_metrics" ) ] ), _.identity
    );
    ESModel.fetchBelongsTo( withTaxa, Taxon, prepareTaxon, function( err ) {
      if( err ) { return callback( err ); }
      DBModel.fetchBelongsTo( withUsers, User, callback );
    });
  }

};

Observation.modelName = "observation";
Observation.indexName = "observations";
Observation.tableName = "observations";

module.exports = Observation;