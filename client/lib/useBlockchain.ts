"use client";

import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { REAL_ESTATE_CONTRACT_ADDRESS } from "../constants";
import RealEstateBuy from "../../artifacts/contracts/RealEstateBuy.sol/RealEstateBuy.json";

export type Property = {
  propertyId: number;
  name: string;
  location: string;
  description: string;
  imageURI: string;
  totalCost: ethers.BigNumberish;
  totalNumberOfTokens: number;
  pricePerToken: ethers.BigNumberish;
  isActive: boolean;
};

// Add a new type for user properties that extends the base Property type
export type UserProperty = Property & {
  userTokens: number;
  investmentValue: number;
};

// Add a type for marketplace sell orders
export type SellOrder = {
  orderId: number;
  propertyId: number;
  seller: string;
  tokenAmount: number;
  pricePerToken: ethers.BigNumberish;
  isActive: boolean;
  property?: Property; // Optional property details
};

export function useBlockchain() {
  const [account, setAccount] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [propertyLoading, setPropertyLoading] = useState(false);
  const connectWallet = useCallback(async () => {
    if (
      typeof window !== "undefined" &&
      typeof window.ethereum !== "undefined"
    ) {
      try {
        // Request account access
        const accounts = await window.ethereum.request({
          method: "eth_requestAccounts",
        });
        setAccount(accounts[0]);
        setIsConnected(true);
        return true;
      } catch (error) {
        console.error("User denied account access", error);
        setError("Failed to connect wallet. User denied access.");
        return false;
      }
    } else {
      setError(
        "MetaMask is not installed. Please install MetaMask to use this feature."
      );
      return false;
    }
  }, []);

  const loadProperties = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Check if MetaMask is available
      if (
        typeof window === "undefined" ||
        typeof window.ethereum === "undefined"
      ) {
        setError("MetaMask is not installed");
        return;
      }

      // Initialize provider and contract
      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(
        REAL_ESTATE_CONTRACT_ADDRESS,
        RealEstateBuy.abi,
        provider
      );

      console.log("Fetching properties from blockchain...");

      try {
        // Get all properties from the contract
        const allPropertiesCount = await contract.getAllPropertiesCount();
        console.log("Raw properties data:", allPropertiesCount);

        // Convert and format properties
        const formattedProperties = [];

        // Loop through each property and add it to our array if it's valid
        for (let i = 0; i < allPropertiesCount; i++) {
          const prop = await contract.getPropertyDetails(i);

          // Skip any invalid properties (e.g., if they have an empty name)
          if (!prop || !prop.name) {
            console.log(`Skipping invalid property at index ${i}`);
            continue;
          }

          // Add each valid property to our array
          formattedProperties.push({
            propertyId: i,
            name: prop.name,
            location: prop.location,
            description: prop.description,
            imageURI: prop.imageURI,
            totalCost: prop.totalCost,
            totalNumberOfTokens: prop.totalNumberOfTokens,
            pricePerToken: prop.pricePerToken,
            isActive: prop.isActive,
          });
        }

        console.log("Formatted properties:", formattedProperties);

        // Don't set properties to empty array if length is 0
        // Instead, keep the previous properties and show an error
        if (formattedProperties.length === 0) {
          console.warn("No properties returned from blockchain");
          setError("No properties found on the blockchain");

          // Don't clear the properties array if it's already populated
          if (properties.length > 0) {
            console.log("Keeping existing properties in state");
            setLoading(false);
            return;
          }
        }

        // Update the state with new properties
        setProperties(formattedProperties);
      } catch (contractError: any) {
        console.error("Error calling contract:", contractError);

        // If we already have properties loaded, don't clear them on error
        if (properties.length > 0) {
          console.log("Error refreshing properties, keeping existing data");
          setError(
            "Error refreshing: " +
              (contractError.message || String(contractError))
          );
        } else {
          setError(
            "Error loading properties: " +
              (contractError.message || String(contractError))
          );
        }
      }
    } catch (error) {
      console.error("Unexpected error:", error);

      // Don't clear properties if we already have some
      if (properties.length > 0) {
        setError("Error refreshing data");
      } else {
        setError("Failed to load properties from blockchain");
      }
    } finally {
      setLoading(false);
    }
  }, [properties.length]); // Only reload when property count changes

  // Purchase tokens for a property
  const purchaseTokens = useCallback(
    async (propertyId: number, tokensToPurchase: number) => {
      if (!isConnected) {
        setError("Please connect your wallet first");
        return false;
      }

      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const contract = new ethers.Contract(
          REAL_ESTATE_CONTRACT_ADDRESS,
          RealEstateBuy.abi,
          signer
        );

        // Find the property to get its price
        const property = properties.find((p) => p.propertyId === propertyId);
        if (!property) throw new Error("Property not found");

        // Calculate total cost
        const tokenPrice = property.pricePerToken;
        const totalCost =
          ethers.toBigInt(tokenPrice) * ethers.toBigInt(tokensToPurchase);

        console.log("Purchasing with details:", {
          propertyId,
          tokensToPurchase,
          totalCost: totalCost.toString(),
          tokenPrice: tokenPrice.toString(),
        });

        // Execute the transaction
        const tx = await contract.purchasePropertyTokens(
          propertyId,
          tokensToPurchase,
          {
            value: totalCost,
          }
        );

        console.log("Transaction hash:", tx.hash);
        const receipt = await tx.wait();
        console.log("Transaction confirmed:", receipt);

        // Reload properties to get updated token counts
        await loadProperties();

        return true;
      } catch (error: any) {
        console.error("Purchase error:", error);

        if (error.reason) {
          setError(error.reason);
        } else if (error.message) {
          setError(error.message);
        } else {
          setError("Transaction failed");
        }

        return false;
      }
    },
    [isConnected, properties, loadProperties]
  );

  // Load properties when component mounts if MetaMask is available
  useEffect(() => {
    // Check if MetaMask is installed
    if (
      typeof window !== "undefined" &&
      typeof window.ethereum !== "undefined"
    ) {
      // Check if already connected
      window.ethereum
        .request({ method: "eth_accounts" })
        .then((accounts: string[]) => {
          if (accounts.length > 0) {
            setAccount(accounts[0]);
            setIsConnected(true);
            loadProperties();
          } else {
            setLoading(false);
          }
        })
        .catch((err: any) => {
          console.error(err);
          setLoading(false);
        });

      // Listen for account changes
      window.ethereum.on("accountsChanged", (accounts: string[]) => {
        console.log("Account changed to:", accounts[0]);
        if (accounts.length > 0) {
          setAccount(accounts[0]);
          setIsConnected(true);

          // Reset properties and reload with the new account
          setProperties([]);
          loadProperties();
        } else {
          setAccount(null);
          setIsConnected(false);
          setProperties([]);
        }
      });
    } else {
      setLoading(false);
    }
  }, [loadProperties]);

  const getPropertyById = useCallback(async (id: number) => {
    if (
      typeof window !== "undefined" &&
      typeof window.ethereum !== "undefined"
    ) {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const contract = new ethers.Contract(
          REAL_ESTATE_CONTRACT_ADDRESS,
          RealEstateBuy.abi,
          provider
        );

        // First check if the property exists

        // Get the property details
        const property = await contract.getPropertyDetails(id);

        return {
          propertyId: Number(property.propertyId),
          name: property.name,
          location: property.location,
          description: property.description,
          imageURI: property.imageURI,
          totalCost: property.totalCost,
          totalNumberOfTokens: Number(property.totalNumberOfTokens),
          pricePerToken: property.pricePerToken,
          isActive: property.isActive,
        };
      } catch (error) {
        console.error("Error fetching property by ID:", error);
        throw new Error("Failed to load property details");
      }
    } else {
      throw new Error("MetaMask is not installed");
    }
  }, []);

  // Update the return type of getUserProperties
  const getUserProperties = useCallback(async (): Promise<UserProperty[]> => {
    if (!isConnected || !account) {
      setError("Please connect your wallet first");
      return [];
    }

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      // Get a signer for the current account to ensure msg.sender is correct
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(
        REAL_ESTATE_CONTRACT_ADDRESS,
        RealEstateBuy.abi,
        signer
      );

      // Get all properties
      const allPropertiesCount = await contract.getAllPropertiesCount();
      console.log("All properties:", allPropertiesCount);
      const userProperties: UserProperty[] = [];

      // For each property, check if the user has tokens
      for (let i = 0; i < allPropertiesCount; i++) {
        const property = await contract.getPropertyDetails(i);
        const propertyId = i;
        try {
          // Call the getMyTokens function from the contract
          const tokenCount = await contract.getMyTokens(propertyId);

          // If user has tokens for this property, add it to the list
          if (Number(tokenCount) > 0) {
            // Calculate investment value correctly
            const pricePerToken = property.pricePerToken;
            const investmentValue =
              Number(ethers.formatEther(pricePerToken)) * Number(tokenCount);

            userProperties.push({
              propertyId: propertyId,
              name: property.name,
              location: property.location,
              description: property.description,
              imageURI: property.imageURI,
              totalCost: property.totalCost,
              totalNumberOfTokens: Number(property.totalNumberOfTokens),
              pricePerToken: property.pricePerToken,
              isActive: property.isActive,
              userTokens: Number(tokenCount),
              investmentValue: investmentValue,
            });
          }
        } catch (error) {
          console.error(
            `Error getting token count for property ${propertyId}:`,
            error
          );
        }
      }

      return userProperties;
    } catch (error) {
      console.error("Error getting user properties:", error);
      setError("Failed to load your investments");
      return [];
    }
  }, [isConnected, account]);

  // Add sell tokens function
  const sellTokens = useCallback(
    async (propertyId: number, tokensToSell: number): Promise<boolean> => {
      if (!isConnected) {
        setError("Please connect your wallet first");
        return false;
      }

      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const contract = new ethers.Contract(
          REAL_ESTATE_CONTRACT_ADDRESS,
          RealEstateBuy.abi,
          signer
        );

        console.log("Selling tokens with details:", {
          propertyId,
          tokensToSell,
        });

        // Execute the transaction
        const tx = await contract.sellPropertyTokens(propertyId, tokensToSell);

        console.log("Transaction hash:", tx.hash);
        const receipt = await tx.wait();
        console.log("Transaction confirmed:", receipt);

        // Reload properties to get updated token counts
        await loadProperties();

        return true;
      } catch (error: any) {
        console.error("Sell error:", error);

        if (error.reason) {
          setError(error.reason);
        } else if (error.message) {
          setError(error.message);
        } else {
          setError("Transaction failed");
        }

        return false;
      }
    },
    [isConnected, loadProperties]
  );

  // Create a marketplace sell order
  const createSellOrder = useCallback(
    async (
      propertyId: number,
      tokenAmount: number,
      pricePerToken: ethers.BigNumberish
    ): Promise<boolean> => {
      if (!isConnected) {
        setError("Please connect your wallet first");
        return false;
      }

      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const contract = new ethers.Contract(
          REAL_ESTATE_CONTRACT_ADDRESS,
          RealEstateBuy.abi,
          signer
        );

        console.log("Creating sell order:", {
          propertyId,
          tokenAmount,
          pricePerToken: pricePerToken.toString(),
        });

        // Execute the transaction
        const tx = await contract.createSellOrder(
          propertyId,
          tokenAmount,
          pricePerToken
        );

        console.log("Transaction hash:", tx.hash);
        const receipt = await tx.wait();
        console.log("Transaction confirmed:", receipt);

        // Reload properties to get updated token counts
        await loadProperties();

        return true;
      } catch (error: any) {
        console.error("Create sell order error:", error);

        if (error.reason) {
          setError(error.reason);
        } else if (error.message) {
          setError(error.message);
        } else {
          setError("Transaction failed");
        }

        return false;
      }
    },
    [isConnected, loadProperties]
  );

  // Cancel a marketplace sell order
  const cancelSellOrder = useCallback(
    async (orderId: number): Promise<boolean> => {
      if (!isConnected) {
        setError("Please connect your wallet first");
        return false;
      }

      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const contract = new ethers.Contract(
          REAL_ESTATE_CONTRACT_ADDRESS,
          RealEstateBuy.abi,
          signer
        );

        console.log("Cancelling sell order:", orderId);

        // Execute the transaction
        const tx = await contract.cancelSellOrder(orderId);

        console.log("Transaction hash:", tx.hash);
        const receipt = await tx.wait();
        console.log("Transaction confirmed:", receipt);

        // Reload properties to get updated token counts
        await loadProperties();

        return true;
      } catch (error: any) {
        console.error("Cancel sell order error:", error);

        if (error.reason) {
          setError(error.reason);
        } else if (error.message) {
          setError(error.message);
        } else {
          setError("Transaction failed");
        }

        return false;
      }
    },
    [isConnected, loadProperties]
  );

  // Buy tokens from a marketplace sell order
  const buyFromSellOrder = useCallback(
    async (
      orderId: number,
      totalCost: ethers.BigNumberish
    ): Promise<boolean> => {
      if (!isConnected) {
        setError("Please connect your wallet first");
        return false;
      }

      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const contract = new ethers.Contract(
          REAL_ESTATE_CONTRACT_ADDRESS,
          RealEstateBuy.abi,
          signer
        );

        console.log("Buying from sell order:", {
          orderId,
          totalCost: totalCost.toString(),
        });

        // Execute the transaction
        const tx = await contract.buyFromSellOrder(orderId, {
          value: totalCost,
        });

        console.log("Transaction hash:", tx.hash);
        const receipt = await tx.wait();
        console.log("Transaction confirmed:", receipt);

        // Reload properties to get updated token counts
        await loadProperties();

        return true;
      } catch (error: any) {
        console.error("Buy from sell order error:", error);

        if (error.reason) {
          setError(error.reason);
        } else if (error.message) {
          setError(error.message);
        } else {
          setError("Transaction failed");
        }

        return false;
      }
    },
    [isConnected, loadProperties]
  );

  // Get all active marketplace sell orders
  const getMarketplaceSellOrders = useCallback(async (): Promise<
    SellOrder[]
  > => {
    if (!isConnected) {
      setError("Please connect your wallet first");
      return [];
    }

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(
        REAL_ESTATE_CONTRACT_ADDRESS,
        RealEstateBuy.abi,
        provider
      );

      // Get all active sell orders
      const orders = await contract.getAllSellOrders();
      console.log("Raw sell orders:", orders);

      // Format orders and add property details
      const formattedOrders: SellOrder[] = [];

      for (const order of orders) {
        try {
          // Get property details for this order
          const property = await contract.getPropertyDetails(order.propertyId);

          formattedOrders.push({
            orderId: Number(order.orderId),
            propertyId: Number(order.propertyId),
            seller: order.seller,
            tokenAmount: Number(order.tokenAmount),
            pricePerToken: order.pricePerToken,
            isActive: order.isActive,
            property: {
              propertyId: Number(order.propertyId),
              name: property.name,
              location: property.location,
              description: property.description,
              imageURI: property.imageURI,
              totalCost: property.totalCost,
              totalNumberOfTokens: Number(property.totalNumberOfTokens),
              pricePerToken: property.pricePerToken,
              isActive: property.isActive,
            },
          });
        } catch (error) {
          console.error(
            `Error getting property details for order ${order.orderId}:`,
            error
          );
        }
      }

      return formattedOrders;
    } catch (error) {
      console.error("Error getting marketplace sell orders:", error);
      setError("Failed to load marketplace listings");
      return [];
    }
  }, [isConnected]);

  // Get my active sell orders
  const getMySellOrders = useCallback(async (): Promise<SellOrder[]> => {
    if (!isConnected || !account) {
      setError("Please connect your wallet first");
      return [];
    }

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(
        REAL_ESTATE_CONTRACT_ADDRESS,
        RealEstateBuy.abi,
        provider
      );

      // Get all sell orders created by the current user
      const orders = await contract.getMySellOrders();
      console.log("Raw my sell orders:", orders);

      // Format orders and add property details
      const formattedOrders: SellOrder[] = [];

      for (const order of orders) {
        try {
          // Get property details for this order
          const property = await contract.getPropertyDetails(order.propertyId);

          formattedOrders.push({
            orderId: Number(order.orderId),
            propertyId: Number(order.propertyId),
            seller: order.seller,
            tokenAmount: Number(order.tokenAmount),
            pricePerToken: order.pricePerToken,
            isActive: order.isActive,
            property: {
              propertyId: Number(order.propertyId),
              name: property.name,
              location: property.location,
              description: property.description,
              imageURI: property.imageURI,
              totalCost: property.totalCost,
              totalNumberOfTokens: Number(property.totalNumberOfTokens),
              pricePerToken: property.pricePerToken,
              isActive: property.isActive,
            },
          });
        } catch (error) {
          console.error(
            `Error getting property details for order ${order.orderId}:`,
            error
          );
        }
      }

      return formattedOrders;
    } catch (error) {
      console.error("Error getting my sell orders:", error);
      setError("Failed to load your marketplace listings");
      return [];
    }
  }, [isConnected, account]);

  return {
    account,
    isConnected,
    properties,
    loading,
    error,
    connectWallet,
    loadProperties,
    purchaseTokens,
    getPropertyById,
    getUserProperties,
    sellTokens,
    createSellOrder,
    cancelSellOrder,
    buyFromSellOrder,
    getMarketplaceSellOrders,
    getMySellOrders,
  };
}

// Type declaration for window.ethereum
declare global {
  interface Window {
    ethereum: any;
  }
}
