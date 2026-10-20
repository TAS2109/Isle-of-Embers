import { onRequestGet as __api_rank_js_onRequestGet } from "C:\\Users\\soimt\\OneDrive\\Desktop\\Isle_of_Embers\\cf\\functions\\api\\rank.js"
import { onRequestPost as __api_rank_js_onRequestPost } from "C:\\Users\\soimt\\OneDrive\\Desktop\\Isle_of_Embers\\cf\\functions\\api\\rank.js"

export const routes = [
    {
      routePath: "/api/rank",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_rank_js_onRequestGet],
    },
  {
      routePath: "/api/rank",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_rank_js_onRequestPost],
    },
  ]