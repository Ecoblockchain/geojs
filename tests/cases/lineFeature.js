// Test geo.lineFeature, geo.d3.lineFeature, and geo.gl.lineFeature

var geo = require('../test-utils').geo;
var $ = require('jquery');
var mockAnimationFrame = require('../test-utils').mockAnimationFrame;
var stepAnimationFrame = require('../test-utils').stepAnimationFrame;
var unmockAnimationFrame = require('../test-utils').unmockAnimationFrame;
var vgl = require('vgl');
var mockVGLRenderer = require('../test-utils').mockVGLRenderer;
var restoreVGLRenderer = require('../test-utils').restoreVGLRenderer;
var waitForIt = require('../test-utils').waitForIt;

describe('geo.lineFeature', function () {
  'use strict';

  var testLines = [
    {
      coord: [{x: 20, y: 10}, {x: 25, y: 10}],
      closed: true
    }, {
      coord: [{x: 30, y: 10}, {x: 35, y: 12}, {x: 32, y: 15}],
      closed: true
    }, {
      coord: [{x: 30, y: 20}, {x: 35, y: 22}, {x: 32, y: 25}]
    }, {
      coord: [{x: 30, y: 30}, {x: 35, y: 32}, {x: 32, y: 35}, {x: 30, y: 30}],
      closed: true
    }, {
      coord: [
        {x: 40, y: 20, width: 10},
        {x: 42, y: 20, width: 5},
        {x: 44, y: 20, width: 2},
        {x: 46, y: 20, width: 2}
      ]
    }, {
      coord: [{x: 50, y: 10}, {x: 50, y: 10}]
    }, {
      coord: [{x: 60, y: 10}]
    }
  ];

  function create_map(opts) {
    var node = $('<div id="map"/>').css({width: '640px', height: '360px'});
    $('#map').remove();
    $('body').append(node);
    opts = $.extend({}, opts);
    opts.node = node;
    return geo.map(opts);
  }

  describe('create', function () {
    it('create function', function () {
      var map, layer, line;
      map = create_map();
      layer = map.createLayer('feature', {renderer: 'd3'});
      line = geo.lineFeature.create(layer);
      expect(line instanceof geo.lineFeature).toBe(true);
    });
  });

  describe('Check class accessors', function () {
    var map, layer, line;
    var pos = [[[0, 0], [10, 5], [5, 10]]];
    it('position', function () {
      map = create_map();
      layer = map.createLayer('feature', {renderer: null});
      line = geo.lineFeature({layer: layer});
      expect(line.position()('a')).toBe('a');
      line.position(pos);
      expect(line.position()).toEqual(pos);
      line.position(function () { return 'b'; });
      expect(line.position()('a')).toEqual('b');

      line = geo.lineFeature({layer: layer, position: pos});
      expect(line.position()).toEqual(pos);
    });

    it('line', function () {
      map = create_map();
      layer = map.createLayer('feature', {renderer: null});
      line = geo.lineFeature({layer: layer});
      expect(line.line()('a')).toBe('a');
      line.line(pos);
      expect(line.line()).toEqual(pos);
      line.line(function () { return 'b'; });
      expect(line.line()('a')).toEqual('b');

      line = geo.lineFeature({layer: layer, line: pos});
      expect(line.line()).toEqual(pos);
    });
  });

  describe('Public utility methods', function () {
    it('pointSearch', function () {
      var map, layer, line, pt, p, data = testLines;
      map = create_map();
      layer = map.createLayer('feature', {renderer: 'd3'});
      line = layer.createFeature('line', {selectionAPI: true});
      line.data(data)
          .line(function (item) {
            return item.coord;
          })
          .style({
            strokeWidth: function (d) {
              return d.width ? d.width : 5;
            },
            closed: function (item) {
              return item.closed;
            }
          });
      pt = line.pointSearch({x: 22, y: 10});
      expect(pt.index).toEqual([0]);
      expect(pt.found.length).toBe(1);
      expect(pt.found[0].coord[0]).toEqual(data[0].coord[0]);
      p = line.featureGcsToDisplay({x: 22, y: 10});
      /* We should land on the line if we are near the specified width.  The
       * search is generous -- ceil(w / 2) + 2 from the center line. */
      pt = line.pointSearch(map.displayToGcs({x: p.x, y: p.y}));
      expect(pt.found.length).toBe(1);
      pt = line.pointSearch(map.displayToGcs({x: p.x, y: p.y + 4.95}));
      expect(pt.found.length).toBe(1);
      pt = line.pointSearch(map.displayToGcs({x: p.x, y: p.y + 5.05}));
      expect(pt.found.length).toBe(0);
      /* We should find a point between the last and first points on a closed
       * line, but not on an open line */
      pt = line.pointSearch({x: 31, y: 12.5});
      expect(pt.found.length).toBe(1);
      pt = line.pointSearch({x: 31, y: 22.5});
      expect(pt.found.length).toBe(0);
      pt = line.pointSearch({x: 31, y: 32.5});
      expect(pt.found.length).toBe(1);
      /* Variable width should match the widest of either end point */
      p = line.featureGcsToDisplay({x: 40, y: 20});
      pt = line.pointSearch(map.displayToGcs({x: p.x, y: p.y + 6.95}));
      expect(pt.found.length).toBe(1);
      pt = line.pointSearch(map.displayToGcs({x: p.x, y: p.y + 7.05}));
      expect(pt.found.length).toBe(0);
      p = line.featureGcsToDisplay({x: 42, y: 20});
      pt = line.pointSearch(map.displayToGcs({x: p.x, y: p.y + 6.95}));
      expect(pt.found.length).toBe(1);
      pt = line.pointSearch(map.displayToGcs({x: p.x, y: p.y + 7.05}));
      expect(pt.found.length).toBe(0);
      p = line.featureGcsToDisplay({x: 44, y: 20});
      pt = line.pointSearch(map.displayToGcs({x: p.x, y: p.y + 4.95}));
      expect(pt.found.length).toBe(1);
      pt = line.pointSearch(map.displayToGcs({x: p.x, y: p.y + 5.05}));
      expect(pt.found.length).toBe(0);
      p = line.featureGcsToDisplay({x: 46, y: 20});
      pt = line.pointSearch(map.displayToGcs({x: p.x, y: p.y + 2.95}));
      expect(pt.found.length).toBe(1);
      pt = line.pointSearch(map.displayToGcs({x: p.x, y: p.y + 3.05}));
      expect(pt.found.length).toBe(0);
      /* We should have match line that is two duplicate points */
      pt = line.pointSearch({x: 50, y: 10});
      expect(pt.found.length).toBe(1);
      /* If we have zero-length data, we get no matches */
      line.data([]);
      pt = line.pointSearch({x: 22, y: 10});
      expect(pt.found.length).toBe(0);
      /* Exceptions will be returned properly */
      line.data(data).style('strokeWidth', function (d, idx) {
        throw new Error('no width');
      });
      expect(function () {
        line.pointSearch({x: 22, y: 10});
      }).toThrow(new Error('no width'));
      /* Stop throwing the exception */
      line.style('strokeWidth', 5);
    });
    it('boxSearch', function () {
      var map, layer, line, idx, data = testLines;
      map = create_map();
      layer = map.createLayer('feature', {renderer: 'd3'});
      line = layer.createFeature('line', {selectionAPI: true});
      line.data(data)
          .line(function (item, itemIdx) {
            return item.coord;
          });
      /* The partial flag is intended to eventually return the lines that have
       * any part of them in a region.  This hasn't been implemented yet. */
      expect(function () {
        line.boxSearch({}, {}, {partial: true});
      }).toThrow(new Error('Unimplemented query method.'));
      /* Otherwise, all points of the line are expected to be in the bounding
       * box. */
      idx = line.boxSearch({x: 19, y: 9}, {x: 26, y: 11});
      expect(idx).toEqual([0]);
      idx = line.boxSearch({x: 19, y: 9}, {x: 24, y: 11});
      expect(idx.length).toBe(0);
      idx = line.boxSearch({x: 29, y: 9}, {x: 36, y: 22});
      expect(idx).toEqual([1]);
      idx = line.boxSearch({x: 29, y: 9}, {x: 36, y: 26});
      expect(idx).toEqual([1, 2]);
    });
  });

  /* This is a basic integration test of geo.d3.lineFeature. */
  describe('geo.d3.lineFeature', function () {
    var map, layer, line;
    it('basic usage', function () {
      mockAnimationFrame();
      map = create_map();
      layer = map.createLayer('feature', {renderer: 'd3'});
      line = layer.createFeature('line', {
        line: function (item) {
          return item.coord;
        },
        style: {
          strokeWidth: function (d) {
            return d.width ? d.width : 5;
          },
          closed: function (item) {
            return item.closed;
          }
        }
      }).data(testLines);
      line.draw();
      stepAnimationFrame();
      expect(layer.node().find('path').length).toBe(7);
      unmockAnimationFrame();
    });
  });

  /* This is a basic integration test of geo.gl.lineFeature. */
  describe('geo.gl.lineFeature', function () {
    var map, layer, line, glCounts;
    it('basic usage', function () {

      mockVGLRenderer();
      map = create_map();
      layer = map.createLayer('feature', {renderer: 'vgl'});
      line = layer.createFeature('line', {
        line: function (item) {
          return item.coord;
        },
        style: {
          strokeWidth: function (d) {
            return d.width ? d.width : 5;
          },
          closed: function (item) {
            return item.closed;
          }
        }
      }).data(testLines);
      line.draw();
      expect(line.verticesPerFeature()).toBe(6);
      glCounts = $.extend({}, vgl.mockCounts());
    });
    waitForIt('next render gl A', function () {
      return vgl.mockCounts().createProgram >= (glCounts.createProgram || 0) + 1;
    });
    it('_exit', function () {
      expect(line.actors().length).toBe(1);
      layer.deleteFeature(line);
      expect(line.actors().length).toBe(0);
      line.data(testLines);
      map.draw();
      restoreVGLRenderer();
    });
  });
});
