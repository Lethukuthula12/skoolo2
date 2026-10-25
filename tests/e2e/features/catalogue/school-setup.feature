@manual @school_setup
Feature: School registration and configuration
  Start with local:reset and the fictional accounts in docs/testing/new-laptop.md.
  Prepare each scenario independently using the Given condition.

  @TC_SCHOOL_001 @P0
  Scenario: Register a school
    Given a new principal uses a unique example.test address
    When they register, confirm local email and save a new fictional school
    Then they become its administrator, reach its workspace and see the unverified state

  @TC_SCHOOL_002 @P0
  Scenario: Claim an existing school
    Given a fictional unclaimed school exists locally
    When a confirmed principal claims it
    Then the principal gains school access and an already claimed school cannot be claimed again

  @TC_SCHOOL_003 @P1
  Scenario: Verification and enrolment
    Given a newly registered school is unverified with an open intake
    When a parent views it before and after the local test operator verifies it
    Then availability follows verification and only the verified school exposes the eligible intake

  @TC_SCHOOL_004 @P1
  Scenario: Profile badge and public details
    Given administrator A opens School profile
    When they change the tagline and upload a supported fictional badge
    Then both persist after refresh and the parent directory shows the saved school details

  @TC_SCHOOL_005 @P1
  Scenario: Bank details belong to the correct school
    Given two schools have distinct fictional bank details
    When a parent opens payment instructions for a School A application
    Then the bank details and reference belong to School A and never School B

  @TC_SCHOOL_006 @P1
  Scenario: Appearance reaches parents
    Given parent A is online in the app
    When administrator A previews then saves new school appearance colours
    Then only the saved appearance reaches the parent app through its documented refresh cycle
