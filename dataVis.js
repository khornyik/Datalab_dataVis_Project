import { feature } from 'https://cdn.jsdelivr.net/npm/topojson-client@3/+esm';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm'



// create margin in case necessary for  future
let margin = {top: 0, left: 0, right: 0, bottom: 0},
  height  = 600 - margin.top - margin.bottom,
  width = 600 - margin.left - margin.right

// create svgs in each div element for scotland map and UK map
let svg = d3.select('#map')
  .append('svg')
  .attr('height', height + margin.top + margin.bottom)
  .attr('width', width + margin.left + margin.right)
  .append('g')
  .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')')


let svg_uk = d3.select('#map_uk')
  .append('svg')
  .attr('height', height + margin.top + margin.bottom)
  .attr('width', width + margin.left + margin.right)
  .append('g')
  .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

// Load and convert topoJSON to geoJSON
const topoData = await d3.json('https://pub-4b983519ddf745f3b60c95e8c2218e71.r2.dev/Scotland_job_map_simplified.topo.json');

const data = feature(topoData, topoData.objects.Scotland_job_map); 

const topoData_uk = await d3.json('data/UK_map_simplified.topo.json')

const data_uk = feature(topoData_uk, topoData_uk.objects.UK_map_level1_2percentSimplified);


// define projections and paths to translate geometric data
let projection = d3.geoIdentity()
  .reflectY(true)
  .fitSize([width, height], data);


let projection_uk = d3.geoIdentity()
  .reflectY(true)
  .fitSize([width, height], data_uk);



let path = d3.geoPath()
  .projection(projection);

let path_uk = d3.geoPath()
  .projection(projection_uk);


let areas = data.features

let areas_uk = data_uk.features


console.log(areas)
console.log(areas_uk)


// draw UK map 

svg_uk.selectAll('.area_uk')
  .data(areas_uk)
  .enter().append('path')
  .attr('class', 'area_uk')
  .attr('d', path_uk);


// anim_years is years used in animation on Scotland map

const anim_years = []

for (let i = 2025; i <= 2050; i++) { 
  anim_years.push(i);
}

// create new column in scotland data which is yearly total for each small area

const groupbySmallArea = d3.rollup(
  areas,
  v => {
    const sums = {};
    anim_years.forEach(y => {
      sums[y] = d3.sum(v, d => + d.properties[y] || 0);
    });
    return sums;
  },
  d => d.properties.small_area
);

areas.forEach(d => {
  const groupby = groupbySmallArea.get(d.properties.small_area);

  anim_years.forEach(y => {
    d.properties[`total_${y}`] = groupby[y]
  });
});



// functions used for zoom on map
let zoom = d3.zoom()
  .scaleExtent([1, 5])
  .on('zoom', handleZoom);


function handleZoom(e) {
  svg.selectAll('.area')
	.attr('transform', e.transform);
}


// Hover and on-click map effects
svg.selectAll('.area')
  .data(areas)
  .enter().append('path')
  .attr('class', 'area')
  .attr('d', path)
  .on('mouseover', function(d) {
    d3.select(this).classed('hovered', true)
    .append('title')
      .text(d => `${d.properties.Izname}`)
  })
  .on('mouseout', function(d){
    d3.select(this).classed('hovered', false)
  })
  .on('click', function(event, d) {


    let tooltip_html = '';

    // get box bounding the small area which has been clicked on 

    const bbox = this.getBBox();

    const centerX = bbox.x + bbox.width / 2;
    const centerY = bbox.y + bbox.height / 2;

    const transform = d3.zoomTransform(svg.node());

    const viewCenterX = (width / 2 - transform.x) / transform.k;
    const viewCenterY = (height / 2 - transform.y) / transform.k;

    const dx = viewCenterX - centerX;
    const dy = viewCenterY - centerY;

    // if the small area has already been clicked - zoom out to center of map 
    if (d3.select(this).classed('clicked')) {

      d3.select(this)
        .classed('clicked', false)
        .call(zoom.scaleBy, 0.01)
        .call(zoom.translateBy, -dx, -dy);

      svg.selectAll('.area').classed('clicked', false);

      document.getElementById('area_info').style.display = 'none';
        
      return}

    // zoom in 
    d3.select(this)
      .classed('clicked', true)
      .call(zoom.scaleBy, 5)  
      .call(zoom.translateBy, dx, dy);

    // show tooltip and information about small area
    const tooltip_year = document.getElementById('year').textContent

    tooltip_html = '<h3>' + d.properties.Izname + '</h3>' +
      '<p>' + 
      'Small Area: ' + d.properties.small_area + '<br>' +
      'DataZone Name: ' + d.properties.DZname + '<br>' +  
      'Health Domain Rank: ' + d.properties.SIMD2020_Health_Domain_Rank + '<br>' +
      'Employment Domain Rank: ' + d.properties.SIMD2020_Employment_Domain_Rank + '<br>' +
      'New Jobs per Working Age Population: ' + d.properties.new_job_per_wg_pop_sa + '<br>' +
      `Total ${tooltip_year} co-benefits: ${d.properties[`total_${tooltip_year}`]}` + '<br>' +
      '</p>';
      
    const [click_x, click_y] = d3.pointer(event, document.getElementById('map'));
      
    document.getElementById('area_info').innerHTML = tooltip_html;
    document.getElementById('area_info').style.left = (width * 1.2) + 'px'; 
    document.getElementById('area_info').style.top = (height * 0.5) + 'px';
    document.getElementById('area_info').style.display = 'block';
    });


// function to show legend on filtering of either map

function sequentialLegend(svg, color, {
  x = 20,
  y = 20,
  width = 200,
  height = 12,
  ticks = 5,
  title = ''
  } = {}) {

  // create g element for legend
  const legend = svg.append('g')
    .attr('transform', `translate(${x},${y})`)
    .classed('legend', true);

  // determine whether we are using scaleSequential or scaleQuantile
  if (typeof color.quantiles === 'function') {

    // this section creates the legend for scaleQuantile

    const thresholds = [color.domain()[0], ...color.quantiles(), color.domain().slice(-1)[0]];
    const color_scheme = color.range();
    const band_width = width / color_scheme.length;

    // create the gradient bar 
    color_scheme.forEach((c, n) => {
      legend.append('rect')
        .classed('legend', true)
        .attr('x', n * band_width)
        .attr('width', band_width)
        .attr('height', height)
        .attr('fill', c);
    });

    // get axis values and position along the gradient
    const scale = d3.scaleLinear()
      .domain([thresholds[0], thresholds[thresholds.length - 1]])
      .range([0, width]);

    legend.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(
        d3.axisBottom(scale)
        .tickValues([thresholds[0], 0.25 * thresholds.slice(-1)[0],
         0.5 * thresholds.slice(-1)[0], 0.75 * thresholds.slice(-1)[0], thresholds.slice(-1)[0]]))
      .classed('legend', true);

  } 

  else {
    
    // this section creates the legend for scaleSequential

    const gradientId = 'legend-gradient';

    const defs = svg.append('defs')
      .classed('legend', true);

    const gradient = defs.append('linearGradient')
      .attr('id', gradientId)
      .attr('x1', '0%')
      .attr('x2', '100%');

    const domain = color.domain();
    const n = 100;

    // create a smooth transition between n and n - 1 in the domain
    d3.range(n).forEach(i => {
      gradient.append('stop')
        .classed('legend', true)
        .attr('offset', `${(i / (n - 1)) * 100}%`)
        .attr('stop-color', color(
          domain[0] + (i / (n - 1)) * (domain[1] - domain[0])
        ));
    });

    // create gradient bar
    legend.append('rect')
      .classed('legend', true)
      .attr('width', width)
      .attr('height', height)
      .style('fill', `url(#${gradientId})`);

    // get axis values and position them onto legend
    const scale = d3.scaleLinear()
      .domain(domain)
      .range([0, width]);

    legend.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(scale).ticks(ticks))
      .classed('legend', true);
  }

  // put a title on the legend
  if (title) {
    legend.append('text')
      .classed('legend', true)
      .attr('y', -6)
      .attr('font-size', 12)
      .attr('font-weight', 'bold')
      .text(title);
  }
}

// years for slider 
const years = [2025, 2030, 2035, 2040, 2045, 2050];

// filter function for slider - Scotland map 
function filterBy(yearIndex) {
 
  // get appropriate year and get the maximum value for the filtered year
  const year = years[yearIndex];

  const max_val = areas.reduce(
    (max, f) => Math.max(max, f.properties[`total_${year}`]), -Infinity
  );

  // determine map colours and fill 
  const color = d3.scaleQuantile()
    .domain([0, 0.1 * max_val, 0.4 * max_val, 0.6 * max_val, max_val])
    .range(d3.schemeBlues[9]);

  svg.selectAll('.area').attr('fill', d => color(d.properties[`total_${year}`]));

  // update text at slider, and replace previous legend
  document.getElementById('year').textContent = year;

  d3.selectAll('.legend').remove()

  sequentialLegend(svg, color, {
    x: 20,
    y: 20,
    width: 175,
    title: `${year} co-benefits (£, million)`
  });
}

filterBy(0)

// call filterBy every time slider is changed for specified year
document.getElementById('slider')
  .addEventListener('input', function (e) { 
    const yearIndex = parseInt(e.target.value, 10);
    filterBy(yearIndex);
});


// function to animate the Scotland map between 2025 - 2050 
function animate(anim_years) {
  let i = 0;

  // start time interval between each transition 
  const interval = setInterval(() => {
    const year = anim_years[i];

    // find cumulative value up to year of current frame
    function cumulativeValue(d, i) {
      return anim_years
        .slice(0, i + 1)
        .reduce((sum, y) => sum + (+ d.properties[`total_${y}`] || 0), 0);
    }

    // get maximum of all cumulative values at the end of 2050
    const max_val = d3.max(areas, d => anim_years.
      reduce((sum, y) => sum + (+ d.properties[`total_${y}`] || 0), 0)
    );

    console.log(max_val)

    // determine colour scheme for the current year 
    const color = d3.scaleQuantile()
      .domain([0, 0.2, 2, 5, max_val])
      .range(d3.schemeBlues[9]);

    // fill small areas based on year's colours
    svg.selectAll('.area')
      .attr('fill', d => color(cumulativeValue(d, i)));

    // remove and renew legend
    d3.selectAll('.legend').remove();

    sequentialLegend(svg, color, {
      x: 20,
      y: 20,
      width: 175,
      title: `${year} co-benefits (£, million)`
    });

    // move onto next year
    i++;
    // stop loop when reaching 2050
    if (i >= anim_years.length) clearInterval(interval);
  }, 50); // 50 ms per year between frames
}

// button calls animate when clicked
document.getElementById('animate_button')
  .addEventListener('click', () => animate(anim_years));

  
// function to fitler UK map 
function filterUK(property) {
 
  // find the maximum value for the property
  const max_val = d3.max(areas_uk, d => d.properties[property])
  
  // determine colour scale for the property
  const color = d3.scaleQuantile()
    .domain([0, 0.1 * max_val, 0.4 * max_val, 0.6 * max_val, max_val])
    .range(d3.schemeBuGn[9]);

  // fill small areas
  svg_uk.selectAll('.area_uk').attr('fill', d => color(d.properties[property]));

  // remove and add new legend
  d3.selectAll('.legend').remove()

  sequentialLegend(svg_uk, color, {
    x: 20,
    y: 20,
    width: 175,
    title: `${property} co-benefits (£, million)`
  });
};

filterUK('sum');

// link all buttons to filter for desired property on-click
document.getElementById('filter_aq')
  .addEventListener('click', () => filterUK('air_quality'))

document.getElementById('filter_damp')
  .addEventListener('click', () => filterUK('dampness'));

document.getElementById('filter_dc')
  .addEventListener('click', () => filterUK('diet_change'))

document.getElementById('filter_ec')
  .addEventListener('click', () => filterUK('excess_cold'))

document.getElementById('filter_eh')
  .addEventListener('click', () => filterUK('excess_heat'))

document.getElementById('filter_pa')
  .addEventListener('click', () => filterUK('physical_activity'))

document.getElementById('filter_sum')
  .addEventListener('click', () => filterUK('sum'));


