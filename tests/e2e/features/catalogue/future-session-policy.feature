@manual @planned
Feature: Agreed session controls awaiting implementation
  This is an acceptance specification, not a claim that the server controls exist.

  @TC_FUTURE_001 @P0
  Scenario: Staff idle and absolute expiry
    Given the proposed server session layer has been implemented
    When a staff session reaches 30 minutes of inactivity or eight hours total lifetime
    Then the server denies further protected requests
    And the interface provides a sign-in continuation
    And a direct API request cannot bypass expiry
