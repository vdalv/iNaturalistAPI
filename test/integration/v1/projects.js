"use strict";
var expect = require( "chai" ).expect,
    request = require( "supertest" ),
    _ = require( "lodash" ),
    jwt = require( "jsonwebtoken" ),
    iNaturalistAPI = require( "../../../lib/inaturalist_api" ),
    config = require( "../../../config.js" ),
    fs = require( "fs" ),
    app = iNaturalistAPI.server( );

var fixtures = JSON.parse( fs.readFileSync( "schema/fixtures.js" ) );

describe( "Projects Routes", function( ) {

  describe( "search", function( ) {
    it( "returns json", function( done ) {
      request( app ).get( "/v1/projects" ).
        expect( function( res ) {
          expect( res.body.page ).to.eq( 1 );
          expect( res.body.per_page ).to.eq( fixtures.elasticsearch.projects.project.length );
          expect( res.body.total_results ).to.eq( fixtures.elasticsearch.projects.project.length );
          expect( res.body.results.length ).to.eq( fixtures.elasticsearch.projects.project.length );
        }
      ).expect( "Content-Type", /json/ ).expect( 200, done );
    });
  });

  describe( "show", function( ) {
    it( "returns json", function( done ) {
      request( app ).get( "/v1/projects/1" ).
        expect( function( res ) {
          var project = res.body.results[0];
          expect( res.body.page ).to.eq( 1 );
          expect( res.body.per_page ).to.eq( 1 );
          expect( res.body.total_results ).to.eq( 1 );
          expect( res.body.results.length ).to.eq( 1 );
          expect( project.id ).to.eq( 1 );
          expect( project.title ).to.eq( "Project One" );
          expect( project.location ).to.eq( "11,12" );
          expect( project.latitude ).to.eq( "11" );
          expect( project.longitude ).to.eq( "12" );
        }
      ).expect( "Content-Type", /json/ ).expect( 200, done );
    });

    it( "returns projects by slug", function( done ) {
      request( app ).get( "/v1/projects/project-two" ).
        expect( function( res ) {
          expect( res.body.results[0].slug ).to.eq( "project-two" );
        }
      ).expect( "Content-Type", /json/ ).expect( 200, done );
    });

    it( "returns an error if too many IDs are requested", function( done ) {
      var ids = [ ], count = 101;
      for( var i = 1 ; i <= count ; i++ ) {
        ids.push( i );
      }
      request( app ).get( "/v1/projects/" + ids.join( "," ) ).
        expect( function( res ) {
          expect( res.body.error ).to.eq( "Too many IDs" );
          expect( res.body.status ).to.eq( 422 );
        }).expect( "Content-Type", /json/ ).expect( 422, done );
    });
  });

  describe( "autocomplete", function( ) {
    it( "returns an empty response if not given a query", function( done ) {
      request( app ).get( "/v1/projects/autocomplete" ).
        expect( function( res ) {
          expect( res.body.page ).to.eq( 1 );
          expect( res.body.per_page ).to.eq( 0 );
          expect( res.body.total_results ).to.eq( 0 );
          expect( res.body.results.length ).to.eq( 0 );
        }).expect( "Content-Type", /json/ ).expect( 200, done );
    });

    it( "returns partial matches", function( done ) {
      request( app ).get( "/v1/projects/autocomplete?q=proj" ).
        expect( function( res ) {
          const projects = _.filter( fixtures.elasticsearch.projects.project, p => (
            p.title.match( /proj/i ) &&
            p.project_type !== "collection" &&
            p.project_type !== "umbrella"
          ) );
          expect( res.body.page ).to.eq( 1 );
          expect( res.body.per_page ).to.eq( projects.length );
          expect( res.body.total_results ).to.eq( projects.length );
          res.body.results = _.sortBy( res.body.results, function( r ) {
            return r.id;
          });
          expect( res.body.results.map( p => p.title ) ).to.include( "Project One" );
          expect( res.body.results.map( p => p.title ) ).to.include( "Project Two" );
          expect( res.body.results.map( p => p.title ) ).to.include( "A Project" );
        }).expect( "Content-Type", /json/ ).expect( 200, done );
    });

    it( "can filter by member_id", function( done ) {
      request( app ).get( "/v1/projects/autocomplete?member_id=123" ).
        expect( function( res ) {
          expect( res.body.page ).to.eq( 1 );
          expect( res.body.results.length ).to.eq( 2 );
        }).expect( "Content-Type", /json/ ).expect( 200, done );
    });
  });

  describe( "members", function( ) {
    it( "returns an error given an unknown project ID", function( done ) {
      request( app ).get( "/v1/projects/888/members" ).
        expect( function( res ) {
          expect( res.body.error ).to.eq( "Unknown project_id" );
          expect( res.body.status ).to.eq( 422 );
        }).expect( "Content-Type", /json/ ).expect( 422, done );
    });

    it( "returns an empty response if not given a query", function( done ) {
      request( app ).get( "/v1/projects/543/members" ).
        expect( function( res ) {
          expect( res.body.page ).to.eq( 1 );
          expect( res.body.per_page ).to.eq( 3 );
          expect( res.body.total_results ).to.eq( 3 );
          expect( res.body.results.length ).to.eq( 3 );
        }).expect( "Content-Type", /json/ ).expect( 200, done );
    });

    it( "defaults to page 1", function( done ) {
      request( app ).get( "/v1/projects/543/members?page=-1" ).
        expect( function( res ) {
          expect( res.body.page ).to.eq( 1 );
          expect( res.body.results.length ).to.eq( 3 );
        }).expect( "Content-Type", /json/ ).expect( 200, done );
    });

    it( "can filter by curators", function( done ) {
      request( app ).get( "/v1/projects/543/members?role=curator" ).
        expect( function( res ) {
          expect( res.body.page ).to.eq( 1 );
          expect( res.body.results.length ).to.eq( 2 );
          expect( res.body.results[0].user.id ).to.eq( 123 );
          expect( res.body.results[1].user.id ).to.eq( 6 );
        }).expect( "Content-Type", /json/ ).expect( 200, done );
    });

    it( "can filter by manager", function( done ) {
      request( app ).get( "/v1/projects/543/members?role=manager" ).
        expect( function( res ) {
          expect( res.body.page ).to.eq( 1 );
          expect( res.body.results.length ).to.eq( 1 );
          expect( res.body.results[0].user.id ).to.eq( 6 );
        }).expect( "Content-Type", /json/ ).expect( 200, done );
    });
  });

  describe( "posts", ( ) => {
    it( "returns posts", done => {
      request( app ).get( "/v1/projects/543/posts" ).
        expect( res => {
          expect( res.body.total_results ).to.eq( 2 );
          expect( res.body.results[0].user.id ).to.eq( 1 );
          expect( res.body.results[0].title ).to.not.be.undefined;
          expect( res.body.results[0].body ).to.not.be.undefined;
        }).expect( "Content-Type", /json/ ).expect( 200, done );
    });
  });

  describe( "subscriptions", ( ) => {
    it( "fails for unauthenticated requests", done => {
      request( app ).get( "/v1/projects/543/subscriptions" ).expect( res => {
        expect( res.error.text ).to.eq( '{"error":"Unauthorized","status":401}' );
      }).expect( "Content-Type", /json/ ).expect( 401, done );
    });

    it( "returns posts", done => {
      var token = jwt.sign({ user_id: 1 }, config.jwtSecret || "secret",
        { algorithm: "HS512" } );
      request( app ).get( "/v1/projects/543/subscriptions" ).set( "Authorization", token ).
        expect( res => {
          expect( res.body.total_results ).to.eq( 1 );
          expect( res.body.results[0].user_id ).to.eq( 1 );
          expect( res.body.results[0].resource_id ).to.eq( 543 );
        }).expect( "Content-Type", /json/ ).expect( 200, done );
    });
  });


});
