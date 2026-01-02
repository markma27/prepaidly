# Backend Testing Guide

## Test Infrastructure

Unit tests are located in `src/test/java/com/prepaidly/` following the same package structure as the main code.

## Test Configuration

- **Test Profile**: Uses `test` profile with `application-test.properties`
- **Database**: In-memory H2 database (no external database needed)
- **Security**: Disabled for testing (can be enabled per-test if needed)

## Running Tests

### Run All Tests
```bash
cd backend
gradle test
```

### Run Specific Test Class
```bash
gradle test --tests "UserControllerTest"
gradle test --tests "EncryptionServiceTest"
```

### Run Tests with Coverage
```bash
gradle test jacocoTestReport
```

### Run Tests Continuously (Watch Mode)
```bash
gradle test --continuous
```

## Test Structure

### Controller Tests (`@WebMvcTest`)
- **Location**: `src/test/java/com/prepaidly/controller/`
- **Example**: `UserControllerTest.java`
- **Purpose**: Test REST API endpoints with mocked dependencies
- **Uses**: MockMvc for HTTP request/response testing

### Service Tests (`@ExtendWith(MockitoExtension.class)`)
- **Location**: `src/test/java/com/prepaidly/service/`
- **Example**: `ScheduleServiceTest.java`, `EncryptionServiceTest.java`
- **Purpose**: Test business logic with mocked repositories
- **Uses**: Mockito for dependency mocking

### Repository Tests (`@DataJpaTest`)
- **Location**: `src/test/java/com/prepaidly/repository/`
- **Example**: `UserRepositoryTest.java`
- **Purpose**: Test database operations with in-memory H2 database
- **Uses**: TestEntityManager for database operations

### Integration Tests (`@SpringBootTest`)
- **Location**: `src/test/java/com/prepaidly/`
- **Example**: `PrepaidlyApplicationTest.java`
- **Purpose**: Test full Spring context loading

## Test Examples

### Controller Test Example
```java
@WebMvcTest(controllers = UserController.class)
@ActiveProfiles("test")
class UserControllerTest {
    @Autowired
    private MockMvc mockMvc;
    
    @MockBean
    private UserRepository userRepository;
    
    @Test
    void testCreateUser_Success() throws Exception {
        // Test implementation
    }
}
```

### Service Test Example
```java
@ExtendWith(MockitoExtension.class)
class ScheduleServiceTest {
    @Mock
    private ScheduleRepository scheduleRepository;
    
    @InjectMocks
    private ScheduleService scheduleService;
    
    @Test
    void testCreateSchedule_Success() {
        // Test implementation
    }
}
```

## Test Coverage

Current test coverage includes:
- ✅ UserController - Full CRUD operations
- ✅ EncryptionService - Encryption/decryption logic
- ✅ ScheduleService - Schedule creation and retrieval
- ✅ UserRepository - Database operations

## Adding New Tests

1. Create test class in appropriate package:
   - Controllers → `src/test/java/com/prepaidly/controller/`
   - Services → `src/test/java/com/prepaidly/service/`
   - Repositories → `src/test/java/com/prepaidly/repository/`

2. Use appropriate test annotations:
   - `@WebMvcTest` for controllers
   - `@ExtendWith(MockitoExtension.class)` for services
   - `@DataJpaTest` for repositories
   - `@SpringBootTest` for integration tests

3. Follow naming convention: `{ClassName}Test.java`

4. Use `@ActiveProfiles("test")` to use test configuration

## Test Configuration File

`src/test/resources/application-test.properties`:
- Uses H2 in-memory database
- Disables security for easier testing
- Provides test values for configuration

## Best Practices

1. **Isolation**: Each test should be independent
2. **Naming**: Use descriptive test method names (`testMethodName_Scenario_ExpectedResult`)
3. **Arrange-Act-Assert**: Structure tests clearly
4. **Mocking**: Mock external dependencies (database, APIs, etc.)
5. **Coverage**: Aim for high coverage of business logic
6. **Fast**: Keep tests fast (use in-memory database)

## Troubleshooting

### Tests Failing Due to Security
- Add `@AutoConfigureMockMvc(addFilters = false)` to controller tests
- Or exclude SecurityConfig: `@WebMvcTest(controllers = UserController.class, excludeAutoConfiguration = SecurityConfig.class)`

### Database Issues
- Ensure `application-test.properties` is configured
- Check H2 dependency is in `build.gradle`
- Verify `@ActiveProfiles("test")` is used

### Mock Issues
- Ensure `@MockBean` for Spring beans
- Use `@Mock` for regular dependencies
- Use `@InjectMocks` for the class under test

