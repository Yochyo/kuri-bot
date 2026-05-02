import {findShopInfo} from "./modules/shop-info";

(async () => {
  console.log(await findShopInfo("hello, is https://www.dakimakuri.com/shop legit", {ignoreMatches: true}))
  console.log(await findShopInfo("hello, is https://booth.pm legit", {ignoreMatches: true}))
})()