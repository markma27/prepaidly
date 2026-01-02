package com.prepaidly.service;

import com.prepaidly.dto.CreateScheduleRequest;
import com.prepaidly.dto.ScheduleResponse;
import com.prepaidly.model.JournalEntry;
import com.prepaidly.model.Schedule;
import com.prepaidly.repository.JournalEntryRepository;
import com.prepaidly.repository.ScheduleRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ScheduleServiceTest {

    @Mock
    private ScheduleRepository scheduleRepository;

    @Mock
    private JournalEntryRepository journalEntryRepository;

    @InjectMocks
    private ScheduleService scheduleService;

    private CreateScheduleRequest createRequest;

    @BeforeEach
    void setUp() {
        createRequest = new CreateScheduleRequest();
        createRequest.setTenantId("test-tenant");
        createRequest.setType(Schedule.ScheduleType.PREPAID);
        createRequest.setStartDate(LocalDate.of(2025, 1, 1));
        createRequest.setEndDate(LocalDate.of(2025, 3, 31));
        createRequest.setTotalAmount(new BigDecimal("3000.00"));
        createRequest.setExpenseAcctCode("6000");
        createRequest.setDeferralAcctCode("2000");
        createRequest.setCreatedBy(1L);
    }

    @Test
    void testCreateSchedule_Success() {
        Schedule savedSchedule = new Schedule();
        savedSchedule.setId(1L);
        savedSchedule.setTenantId("test-tenant");
        savedSchedule.setType(Schedule.ScheduleType.PREPAID);
        savedSchedule.setStartDate(LocalDate.of(2025, 1, 1));
        savedSchedule.setEndDate(LocalDate.of(2025, 3, 31));
        savedSchedule.setTotalAmount(new BigDecimal("3000.00"));

        when(scheduleRepository.save(any(Schedule.class))).thenReturn(savedSchedule);
        when(journalEntryRepository.save(any(JournalEntry.class))).thenAnswer(invocation -> {
            JournalEntry entry = invocation.getArgument(0);
            entry.setId(1L);
            return entry;
        });
        when(journalEntryRepository.findByScheduleId(1L)).thenReturn(Collections.emptyList());

        ScheduleResponse response = scheduleService.createSchedule(createRequest);

        assertNotNull(response);
        assertEquals("test-tenant", response.getTenantId());
        verify(scheduleRepository, times(1)).save(any(Schedule.class));
        // Should create 3 journal entries (Jan, Feb, Mar)
        verify(journalEntryRepository, times(3)).save(any(JournalEntry.class));
    }

    @Test
    void testCreateSchedule_InvalidDateRange() {
        createRequest.setStartDate(LocalDate.of(2025, 3, 31));
        createRequest.setEndDate(LocalDate.of(2025, 1, 1));

        assertThrows(IllegalArgumentException.class, () -> {
            scheduleService.createSchedule(createRequest);
        });

        verify(scheduleRepository, never()).save(any(Schedule.class));
    }

    @Test
    void testGetSchedulesByTenant_Success() {
        Schedule schedule1 = new Schedule();
        schedule1.setId(1L);
        schedule1.setTenantId("test-tenant");
        schedule1.setTotalAmount(new BigDecimal("1000.00"));

        Schedule schedule2 = new Schedule();
        schedule2.setId(2L);
        schedule2.setTenantId("test-tenant");
        schedule2.setTotalAmount(new BigDecimal("2000.00"));

        when(scheduleRepository.findByTenantId("test-tenant"))
            .thenReturn(List.of(schedule1, schedule2));
        when(journalEntryRepository.findByScheduleId(1L))
            .thenReturn(Collections.emptyList());
        when(journalEntryRepository.findByScheduleId(2L))
            .thenReturn(Collections.emptyList());

        List<ScheduleResponse> responses = scheduleService.getSchedulesByTenant("test-tenant");

        assertEquals(2, responses.size());
        verify(scheduleRepository, times(1)).findByTenantId("test-tenant");
    }

    @Test
    void testGetScheduleById_Success() {
        Schedule schedule = new Schedule();
        schedule.setId(1L);
        schedule.setTenantId("test-tenant");
        schedule.setTotalAmount(new BigDecimal("1000.00"));

        when(scheduleRepository.findById(1L)).thenReturn(Optional.of(schedule));
        when(journalEntryRepository.findByScheduleId(1L)).thenReturn(Collections.emptyList());

        ScheduleResponse response = scheduleService.getScheduleById(1L);

        assertNotNull(response);
        assertEquals(1L, response.getId());
        assertEquals("test-tenant", response.getTenantId());
        verify(scheduleRepository, times(1)).findById(1L);
        verify(journalEntryRepository, times(1)).findByScheduleId(1L);
    }

    @Test
    void testGetScheduleById_NotFound() {
        when(scheduleRepository.findById(999L)).thenReturn(Optional.empty());

        assertThrows(RuntimeException.class, () -> {
            scheduleService.getScheduleById(999L);
        });

        verify(scheduleRepository, times(1)).findById(999L);
    }
}

