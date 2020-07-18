FROM alpine
RUN apk add --no-cache --upgrade bash

ARG JMETER_VERSION="5.3"

ENV JMETER_HOME /opt/apache-jmeter-${JMETER_VERSION}
ENV JMETER_BIN  ${JMETER_HOME}/bin
ENV MIRROR_HOST http://mirrors.ocf.berkeley.edu/apache/jmeter
ENV JMETER_DOWNLOAD_URL ${MIRROR_HOST}/binaries/apache-jmeter-${JMETER_VERSION}.tgz
ENV JMETER_PLUGINS_DOWNLOAD_URL https://repo1.maven.org/maven2/kg/apc
ENV JMETER_PLUGINS_FOLDER ${JMETER_HOME}/lib/ext/

RUN apk update \
	&& apk upgrade \
	&& apk add ca-certificates \
	&& update-ca-certificates \
            && apk add --update openjdk8-jre curl unzip bash \            
	&& rm -rf /var/cache/apk/* \
	&& mkdir -p /tmp/dependencies  \
	&& curl -L ${JMETER_DOWNLOAD_URL} >  /tmp/dependencies/apache-jmeter-${JMETER_VERSION}.tgz  \
	&& mkdir -p /opt  \
	&& tar -xzf /tmp/dependencies/apache-jmeter-${JMETER_VERSION}.tgz -C /opt  \
	&& rm -rf /tmp/dependencies \
	&& curl -L ${JMETER_PLUGINS_DOWNLOAD_URL}/cmdrunner/2.2/cmdrunner-2.2.jar -o ${JMETER_HOME}/lib/cmdrunner-2.2.jar \
	&& curl -L ${JMETER_PLUGINS_DOWNLOAD_URL}/jmeter-plugins-manager/1.4/jmeter-plugins-manager-1.4.jar -o ${JMETER_PLUGINS_FOLDER}/jmeter-plugins-manager-1.4.jar

ENV PATH $PATH:$JMETER_BIN
RUN jmeter -n