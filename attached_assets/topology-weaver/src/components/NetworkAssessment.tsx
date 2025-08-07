import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NetworkAssessment, NetworkElement } from "@/types/topology";
import { useProviders } from "@/contexts/ProviderContext";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ChevronLeft, Check } from "lucide-react";

interface NetworkAssessmentProps {
  onComplete: (elements: NetworkElement[]) => void;
  onSkip: () => void;
}

interface AssessmentStep {
  title: string;
  description: string;
  question: string;
  options: Array<{
    id: string;
    label: string;
    type: string;
  }>;
  field: keyof NetworkAssessment;
  hasField: keyof NetworkAssessment | null;
  isCustomInput?: boolean;
}

const NetworkAssessmentComponent: React.FC<NetworkAssessmentProps> = ({
  onComplete,
  onSkip,
}) => {
  const { setSelectedProviders, setAdditionalProviders } = useProviders();
  const [currentStep, setCurrentStep] = useState(0);
  const [assessment, setAssessment] = useState<NetworkAssessment>({
    hasPublicConnectivity: false,
    publicConnectivityTypes: [],
    hasPrivateConnectivity: false,
    privateConnectivityTypes: [],
    hasHyperscalers: false,
    hyperscalerTypes: [],
    selectedProviders: [],
    additionalElements: [],
  });
  const [customInput, setCustomInput] = useState("");

  const steps = [
    {
      title: "Public Connectivity",
      description: "Does your network connect to the public internet?",
      question: "Select all that apply:",
      options: [
        { id: "internet", label: "Direct Internet Access (DIA)", type: "internet" },
        { id: "broadband", label: "Broadband Internet", type: "internet" },
        { id: "satellite", label: "Satellite Internet", type: "internet" },
      ],
      field: "publicConnectivityTypes" as keyof NetworkAssessment,
      hasField: "hasPublicConnectivity" as keyof NetworkAssessment,
    },
    {
      title: "Private Connectivity", 
      description: "Does your network use private WAN connections?",
      question: "Select all that apply:",
      options: [
        { id: "mpls", label: "MPLS Network", type: "mpls" },
        { id: "vpls", label: "VPLS (Virtual Private LAN Service)", type: "vpls" },
        { id: "point-to-point", label: "Point-to-Point Circuits", type: "point-to-point" },
        { id: "vpn", label: "Site-to-Site VPN", type: "internet" },
      ],
      field: "privateConnectivityTypes" as keyof NetworkAssessment,
      hasField: "hasPrivateConnectivity" as keyof NetworkAssessment,
    },
    {
      title: "Cloud Hyperscalers",
      description: "Does your network connect to public cloud providers?",
      question: "Select all that apply:",
      options: [
        { id: "aws", label: "Amazon Web Services (AWS)", type: "aws" },
        { id: "azure", label: "Microsoft Azure", type: "azure" },
        { id: "gcp", label: "Google Cloud Platform (GCP)", type: "gcp" },
        { id: "oracle", label: "Oracle Cloud Infrastructure (OCI)", type: "oracle" },
      ],
      field: "hyperscalerTypes" as keyof NetworkAssessment,
      hasField: "hasHyperscalers" as keyof NetworkAssessment,
    },
    {
      title: "Service Providers",
      description: "Which service providers does your network use?",
      question: "Select all providers you work with:",
      options: [
        { id: "att", label: "AT&T", type: "provider" },
        { id: "verizon", label: "Verizon", type: "provider" },
        { id: "lumen", label: "Lumen (CenturyLink)", type: "provider" },
        { id: "comcast", label: "Comcast Business", type: "provider" },
        { id: "spectrum", label: "Spectrum Enterprise", type: "provider" },
        { id: "zayo", label: "Zayo", type: "provider" },
        { id: "cogent", label: "Cogent", type: "provider" },
        { id: "ntt", label: "NTT Communications", type: "provider" },
        { id: "orange", label: "Orange Business", type: "provider" },
        { id: "bt", label: "BT Global", type: "provider" },
      ],
      field: "selectedProviders" as keyof NetworkAssessment,
      hasField: null,
    },
    {
      title: "Additional Elements",
      description: "Any other network elements or custom providers?",  
      question: "Enter any additional provider names or network elements:",
      options: [],
      field: "additionalElements" as keyof NetworkAssessment,
      hasField: null,
      isCustomInput: true,
    }
  ];

  const handleOptionChange = (optionId: string, checked: boolean, stepIndex: number) => {
    const step = steps[stepIndex];
    const currentValues = assessment[step.field] as string[];

    let newValues;
    if (checked) {
      newValues = [...currentValues, optionId];
    } else {
      newValues = currentValues.filter(id => id !== optionId);
    }

    setAssessment(prev => ({
      ...prev,
      [step.field]: newValues,
      [step.hasField]: newValues.length > 0,
    }));
  };

    const handleCustomInput = (value: string) => {
    setCustomInput(value);
    const currentValues = assessment.additionalElements || [];
    const customElements = value.split(',').map(s => s.trim()).filter(s => s.length > 0);
    setAssessment(prev => ({
      ...prev,
      additionalElements: customElements
    }));
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    // Save provider data to context
    setSelectedProviders(assessment.selectedProviders || []);
    setAdditionalProviders(assessment.additionalElements || []);
    
    const networkElements: NetworkElement[] = [];

    // Add public connectivity elements
    if (assessment.hasPublicConnectivity) {
      networkElements.push({
        id: 'internet',
        type: 'internet',
        name: 'Internet',
        enabled: true,
      });
    }

    // Add private connectivity elements
    assessment.privateConnectivityTypes.forEach(type => {
      if (type === 'mpls') {
        networkElements.push({
          id: 'mpls',
          type: 'mpls',
          name: 'MPLS',
          enabled: true,
        });
      } else if (type === 'vpls') {
        networkElements.push({
          id: 'vpls',
          type: 'vpls',
          name: 'VPLS',
          enabled: true,
        });
      } else if (type === 'point-to-point') {
        networkElements.push({
          id: 'point-to-point',
          type: 'point-to-point',
          name: 'Point-to-Point',
          enabled: true,
        });
      }
    });

    // Add hyperscaler elements
    assessment.hyperscalerTypes.forEach(type => {
      const typeMap: Record<string, { type: NetworkElement['type'], name: string }> = {
        'aws': { type: 'aws', name: 'AWS' },
        'azure': { type: 'azure', name: 'Azure' },
        'gcp': { type: 'gcp', name: 'Google Cloud' },
        'oracle': { type: 'oracle', name: 'Oracle Cloud' },
      };

      const elementInfo = typeMap[type];
      if (elementInfo) {
        networkElements.push({
          id: type,
          type: elementInfo.type,
          name: elementInfo.name,
          enabled: true,
        });
      }
    });

    // Always include internet if not already added
    if (!networkElements.find(el => el.type === 'internet')) {
      networkElements.push({
        id: 'internet',
        type: 'internet',
        name: 'Internet',
        enabled: true,
      });
    }
      // Add additional elements
    assessment.additionalElements.forEach(element => {
      networkElements.push({
        id: element.toLowerCase().replace(/\s+/g, '-'),
        type: 'custom',
        name: element,
        enabled: true,
      });
    });

    onComplete(networkElements);
  };

  const currentStepData = steps[currentStep];
  const currentValues = assessment[currentStepData.field] as string[];

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>{currentStepData.title}</CardTitle>
            <p className="text-sm text-gray-600 mt-1">{currentStepData.description}</p>
          </div>
          <div className="text-sm text-gray-500">
            Step {currentStep + 1} of {steps.length}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <h3 className="font-medium mb-4">{currentStepData.question}</h3>
             {currentStepData.isCustomInput ? (
                <div className="space-y-4">
                  <textarea
                    className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={4}
                    placeholder="Enter custom provider names or additional network elements, separated by commas"
                    value={customInput}
                    onChange={(e) => handleCustomInput(e.target.value)}
                  />
                  <p className="text-sm text-gray-500">
                    Example: "Custom ISP Name, Private Network Provider, Special WAN Service"
                  </p>
                </div>
              ) : (
                <div className="space-y-3 mb-6">
                  {currentStepData.options.map((option) => (
                    <div key={option.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={option.id}
                        checked={currentValues.includes(option.id)}
                        onCheckedChange={(checked) =>
                          handleOptionChange(option.id, checked as boolean, currentStep)
                        }
                      />
                      <Label htmlFor={option.id} className="flex-1 cursor-pointer">
                        {option.label}
                      </Label>
                    </div>
                  ))}
                </div>
              )}
          </motion.div>
        </AnimatePresence>

        <div className="flex justify-between">
          <div className="flex gap-2">
            <Button variant="outline" onClick={onSkip}>
              Skip Assessment
            </Button>
            {currentStep > 0 && (
              <Button variant="outline" onClick={handlePrevious}>
                <ChevronLeft className="h-4 w-4 mr-2" />
                Previous
              </Button>
            )}
          </div>
          <Button onClick={handleNext}>
            {currentStep === steps.length - 1 ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                Complete
              </>
            ) : (
              <>
                Next
                <ChevronRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default NetworkAssessmentComponent;