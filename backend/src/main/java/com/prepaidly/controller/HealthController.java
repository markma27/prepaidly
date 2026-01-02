package com.prepaidly.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Health Check Controller
 * 
 * Provides a simple health check endpoint to verify that the backend service is running
 * and responding to requests. This is commonly used by:
 * - Load balancers to determine if the service is healthy
 * - Monitoring systems to check service availability
 * - Deployment pipelines to verify successful deployment
 * - Development/debugging to quickly test if the server is up
 * 
 * The endpoint returns a simple JSON response indicating the service status.
 * This is a basic health check - for more comprehensive health monitoring,
 * consider using Spring Boot Actuator's /actuator/health endpoint.
 */
@RestController
@RequestMapping("/api/health")
public class HealthController {

    /**
     * Health Check Endpoint
     * 
     * Returns a simple health status response indicating that the service is operational.
     * 
     * @return ResponseEntity containing a Map with:
     *         - "status": Always returns "ok" when the endpoint is reachable
     *         - "service": The name of the service ("prepaidly-backend")
     * 
     * @apiNote GET /api/health
     * 
     * @example Response:
     * {
     *   "status": "ok",
     *   "service": "prepaidly-backend"
     * }
     * 
     * @usage This endpoint can be called without authentication and should respond
     *        quickly. It does not perform any database or external service checks,
     *        it simply confirms the web server is running and can handle requests.
     */
    @GetMapping
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(Map.of("status", "ok", "service", "prepaidly-backend"));
    }
}

