package com.prepaidly;

import com.prepaidly.config.XeroConfig;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableCaching
@EnableConfigurationProperties(XeroConfig.class)
@EnableScheduling
public class PrepaidlyApplication {

    public static void main(String[] args) {
        SpringApplication.run(PrepaidlyApplication.class, args);
    }
}

