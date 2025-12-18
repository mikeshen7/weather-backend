'use strict';
const locationDb = require('../models/locationsDb');

const cache = module.exports;

// cache.refreshResortsCache = async function () {
//   console.log(`***** Refreshing resort cache *****`);
//   cache['resorts'] = await resortDb.find({});
//   const resorts = cache['resorts']
// //   resorts.forEach((resort) =>  console.log(`${resort.name}`));
//   return cache['resorts'];
// };

cache.refreshLocationsCache = async function () {
  console.log(`***** Refreshing location cache *****`);
  cache['locations'] = await locationDb.find({});
  const locations = cache['locations']
  return cache['locations'];
};
