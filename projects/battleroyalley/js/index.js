var toc;
var tocPath;
var tocItems;

window.onload = () => {
    toc = document.querySelector( '.toc' );
    tocPath = document.querySelector( '.toc-marker path' );

    document.body.addEventListener( 'resize', drawPath, false );
    document.body.addEventListener( 'scroll', sync, false );

    drawPath();
};

// Factor of screen size that the element must cross
// before it's considered visible
var TOP_MARGIN = 0;
var BOTTOM_MARGIN = 0;

var pathLength;

var lastPathStart,
		lastPathEnd;


function drawPath() {
  tocItems = [].slice.call( toc.querySelectorAll( 'li' ) );

  // Cache element references and emeasurements
  tocItems = tocItems.map( (item) => {
    var anchor = item.querySelector( 'a' );
    var target = document.getElementById( anchor.getAttribute( 'href' ).slice( 1 ) );

    return {
      listItem: item,
      anchor: anchor,
      target: target
    };
  });

  // Remove missing targets
  tocItems = tocItems.filter( (item) => {
    return !!item.target;
  } );

  var path = [];
  var pathIndent;

  tocItems.forEach( function( item, i ) {

    var x = item.anchor.offsetLeft - 5,
        y = item.anchor.offsetTop,
        height = item.anchor.offsetHeight;

    if( i === 0 ) {
      path.push( 'M', x, y, 'L', x, y + height );
      item.pathStart = 0;
    }
    else {
      // Draw an additional line when there's a change in
      // indent levels
      if( pathIndent !== x ) path.push( 'L', pathIndent, y );

      path.push( 'L', x, y );

      // Set the current path so that we can measure it
      tocPath.setAttribute( 'd', path.join( ' ' ) );
      item.pathStart = tocPath.getTotalLength() || 0;

      path.push( 'L', x, y + height );
    }

    pathIndent = x;

    tocPath.setAttribute( 'd', path.join( ' ' ) );
    item.pathEnd = tocPath.getTotalLength();

  } );

  pathLength = tocPath.getTotalLength();

  sync();

}

function sync() {

  var windowHeight = window.innerHeight;

  document.querySelector(".toc-marker").setAttribute("height", document.querySelector(".toc > ul").clientHeight.toString()); // Firefox
  document.querySelector(".toc-marker").style.height = document.querySelector(".toc > ul").clientHeight.toString(); // Chrome

  var pathStart = pathLength,
      pathEnd = 0;

  var visibleItems = 0;

  tocItems.forEach( function( item ) {

    var targetBounds = item.target.getBoundingClientRect();

    if( targetBounds.bottom > windowHeight * TOP_MARGIN && targetBounds.top < windowHeight * ( 1 - BOTTOM_MARGIN ) ) {
      pathStart = Math.min( item.pathStart, pathStart );
      pathEnd = Math.max( item.pathEnd, pathEnd );

      visibleItems += 1;

      item.listItem.classList.add( 'visible' );
    }
    else
      item.listItem.classList.remove( 'visible' );

  } );

  // Specify the visible path or hide the path altogether
  // if there are no visible items
  if( visibleItems > 0 && pathStart < pathEnd ) {
    if( pathStart !== lastPathStart || pathEnd !== lastPathEnd ) {
      tocPath.setAttribute( 'stroke-dashoffset', '1' );
      tocPath.setAttribute( 'stroke-dasharray', '1, '+ pathStart +', '+ ( pathEnd - pathStart ) +', ' + pathLength );
      tocPath.setAttribute( 'opacity', 1 );
    }
  }
  else {
    tocPath.setAttribute( 'opacity', 0 );
  }

  lastPathStart = pathStart;
  lastPathEnd = pathEnd;
}