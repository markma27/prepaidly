package com.prepaidly;

import com.prepaidly.config.XeroConfig;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableConfigurationProperties(XeroConfig.class)
public class PrepaidlyApplication {

    public static void main(String[] args) {
        SpringApplication.run(PrepaidlyApplication.class, args);
    }
}

