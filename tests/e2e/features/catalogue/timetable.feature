@manual @timetable
Feature: Teacher and class timetable
  Start with local:reset and the fictional accounts in docs/testing/new-laptop.md.
  Prepare each scenario independently using the Given condition.

  @TC_TIME_001 @P0
  Scenario: Place a lesson
    Given school day periods and teaching assignments exist
    When an authorised user schedules Teacher A for Mathematics in Grade 3 A
    Then the saved lesson appears in both teacher and class views after refresh

  @TC_TIME_002 @P0
  Scenario: Reject conflicts
    Given Teacher A already has a lesson in a slot
    When another lesson uses the same teacher or class at that time
    Then the conflict is rejected and the existing lesson remains

  @TC_TIME_003 @P1
  Scenario: Remove lessons and periods
    Given a saved lesson uses a school period
    When an authorised user removes the lesson or its period
    Then dependency rules are explained and all timetable views remain consistent

  @TC_TIME_004 @P1
  Scenario: Calendar export
    Given Teacher A has saved lessons
    When they export the timetable
    Then the calendar file includes correct lessons and times without another school’s data
