/*
 * Copyright 2011-2019 GatlingCorp (https://gatling.io)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package smartpass

import io.gatling.core.Predef._
import io.gatling.http.Predef._
import scala.concurrent.duration._

class Get extends Simulation {
  val baseURL = scala.sys.env.getOrElse("URL","https://pass.auone.jp")
  val targetPath = scala.sys.env.getOrElse("TARGET","/main")
  val vtkt = scala.sys.env.getOrElse("VTKT","DgI1hAiVf-Wxf-an1KNJU4AbDyO5WYASR-CYtnhKft8_0Z6DrjnlCfseaLU896vVsv7bMZqM-Yp5f6zrS3hk-5HAgPKqiwjKNQn1gmk3t7way3Gdu2SAA_v5uDlWvTiRXD-y863GNK8UXJzH-awz14")
  val ua = scala.sys.env.getOrElse("UA","Mozilla/5.0 (iPhone; CPU iPhone OS 7_1_2 like Mac OS X) AppleWebKit/537.51.2 (KHTML, like Gecko) Mobile/11D257/spass-app/4.1.0")
  val ps: String = scala.sys.env.getOrElse("PS","5")
  val lt: String = scala.sys.env.getOrElse("LT","5")


  val httpProtocol = http
    .baseUrl(baseURL)
    .acceptHeader("text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8") // Here are the common headers
    .doNotTrackHeader("1")
    .acceptLanguageHeader("ja,en-US;q=0.8,en;q=0.6")
    .acceptEncodingHeader("gzip, deflate, sdch")
    .userAgentHeader(ua)

  val scn = scenario("pass").exec(
      exec(addCookie(Cookie("VTKT",vtkt))),
      exec(http("get").get(targetPath))
    )

  setUp(
    scn.inject(
      rampUsersPerSec(1) to (ps.toInt) during(10 seconds),
      constantUsersPerSec(ps.toInt) during(lt.toInt seconds)
    ).protocols(httpProtocol)
  )
}
