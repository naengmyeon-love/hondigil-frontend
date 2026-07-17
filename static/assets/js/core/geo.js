function decodeRouteShape(encoded){
  var index=0,lat=0,lng=0,coords=[],factor=1000000;
  while(index<encoded.length){
    var byte,shift=0,result=0;
    do{byte=encoded.charCodeAt(index++)-63;result|=(byte&31)<<shift;shift+=5;}while(byte>=32&&index<=encoded.length);
    lat+=(result&1)?~(result>>1):(result>>1);shift=0;result=0;
    do{byte=encoded.charCodeAt(index++)-63;result|=(byte&31)<<shift;shift+=5;}while(byte>=32&&index<=encoded.length);
    lng+=(result&1)?~(result>>1):(result>>1);coords.push([lat/factor,lng/factor]);
  }
  return coords;
}
function geoDistanceKm(a,b){
  var rad=Math.PI/180,dLat=(b[0]-a[0])*rad,dLng=(b[1]-a[1])*rad;
  var value=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(a[0]*rad)*Math.cos(b[0]*rad)*Math.sin(dLng/2)*Math.sin(dLng/2);
  return 6371*2*Math.atan2(Math.sqrt(value),Math.sqrt(1-value));
}
function routeDistanceKm(coords){var total=0;for(var i=1;i<coords.length;i++)total+=geoDistanceKm(coords[i-1],coords[i]);return total;}
function routeToDistance(baseCoords,targetKm){
  if(!Array.isArray(baseCoords)||baseCoords.length<2||targetKm<=0)return baseCoords||[];
  var result=[baseCoords[0].slice()],travelled=0,index=0,direction=1,guard=0;
  while(travelled<targetKm-0.000001&&guard<20000){
    guard+=1;var nextIndex=index+direction;
    if(nextIndex<0||nextIndex>=baseCoords.length){direction*=-1;nextIndex=index+direction;}
    var from=baseCoords[index],to=baseCoords[nextIndex],segment=geoDistanceKm(from,to),remaining=targetKm-travelled;
    if(segment<=0.000001){index=nextIndex;continue;}
    if(segment<=remaining+0.000001){result.push(to.slice());travelled+=segment;index=nextIndex;continue;}
    var ratio=remaining/segment;
    result.push([from[0]+(to[0]-from[0])*ratio,from[1]+(to[1]-from[1])*ratio]);travelled=targetKm;
  }
  return result;
}
function prepareCourseRoutes(){
  courses.forEach(function(course){
    var target=Number(course.distance),encoded=routeShapes[course.id],base=encoded?decodeRouteShape(encoded):course.coords;
    if(!Array.isArray(base)||base.length<2)return;
    var baseDistance=routeDistanceKm(base);
    course.turnaround=base[base.length-1].slice();
    course.coords=routeToDistance(base,target);
    course.mapDistance=routeDistanceKm(course.coords);
    course.distance=Math.round(course.mapDistance*10)/10;
    course.minDistance=Math.round(course.distance*.8*10)/10;
    course.routeNote=target>baseDistance+.05?'보행로·반환 구간 포함':'OpenStreetMap 보행로 기준';
  });
}
