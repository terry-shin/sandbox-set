FROM openjdk:11
ENV LANG C.UTF-8

# 開発チームの連絡先
MAINTAINER SMPS_DEV Development Team <xxx@mediba.jp>

# gatlingのバージョンを指定
ENV GATLING_VERSION=3.3.1

RUN apt-get update -y \
    && apt-get upgrade -y \
    && apt-get install -y wget bsdtar


# gatlingをインストール、セットアップ
RUN set -ex \
    && wget -O ./gatling.zip https://repo1.maven.org/maven2/io/gatling/highcharts/gatling-charts-highcharts-bundle/$GATLING_VERSION/gatling-charts-highcharts-bundle-$GATLING_VERSION-bundle.zip \
    && unzip gatling.zip \
    && mv ./gatling-charts-highcharts-bundle-$GATLING_VERSION gatling \
    && mkdir -p ./gatling/user-files/simulations/smartpass

# COPY ./test/get.scala ./gatling/user-files/simulations/pass
